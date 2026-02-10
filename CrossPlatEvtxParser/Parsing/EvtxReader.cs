using CrossPlatEvtxParser.Models;

namespace CrossPlatEvtxParser.Parsing;

/// <summary>
///     Reads and parses EVTX files. Handles file header, chunk iteration, and event record extraction.
/// </summary>
public class EvtxReader : IDisposable
{
    private readonly bool _ownsStream;
    private readonly BinaryReader _reader;
    private readonly Stream _stream;

    public EvtxReader(string filePath)
    {
        _stream = File.OpenRead(filePath);
        _reader = new BinaryReader(_stream);
        _ownsStream = true;
    }

    public EvtxReader(Stream stream, bool ownsStream = false)
    {
        _stream = stream;
        _reader = new BinaryReader(stream);
        _ownsStream = ownsStream;
    }

    public void Dispose()
    {
        _reader.Dispose();
        if (_ownsStream)
            _stream.Dispose();
    }

    /// <summary>Read the complete EVTX file.</summary>
    public EvtxFile ReadFile(string? filePath = null)
    {
        EvtxFile file = new()
        {
            FilePath = filePath ?? "(stream)",
            FileSize = _stream.Length
        };

        // 1. Read file header (4096 bytes)
        file.Header = ReadFileHeader();

        // 2. Read chunks
        // Chunks start at offset 4096 and are each 65536 bytes
        long chunkStart = EvtxFileHeader.HeaderBlockSize;
        int chunkIndex = 0;

        while (chunkStart + EvtxChunkHeader.ChunkSize <= _stream.Length)
        {
            _stream.Position = chunkStart;
            EvtxChunk? chunk = ReadChunk(chunkIndex);
            if (chunk != null) file.Chunks.Add(chunk);
            chunkStart += EvtxChunkHeader.ChunkSize;
            chunkIndex++;
        }

        return file;
    }

    /// <summary>Lazily enumerate event records without loading all into memory.</summary>
    public IEnumerable<(EvtxEventRecord Record, int ChunkIndex)> EnumerateRecords()
    {
        // Read file header first
        _stream.Position = 0;
        EvtxFileHeader header = ReadFileHeader();

        long chunkStart = EvtxFileHeader.HeaderBlockSize;
        int chunkIndex = 0;

        while (chunkStart + EvtxChunkHeader.ChunkSize <= _stream.Length)
        {
            _stream.Position = chunkStart;
            byte[] chunkData = _reader.ReadBytes(EvtxChunkHeader.ChunkSize);

            // Validate chunk signature
            if (chunkData.Length == EvtxChunkHeader.ChunkSize &&
                chunkData[0] == (byte)'E' && chunkData[1] == (byte)'l' &&
                chunkData[2] == (byte)'f' && chunkData[3] == (byte)'C' &&
                chunkData[4] == (byte)'h' && chunkData[5] == (byte)'n' &&
                chunkData[6] == (byte)'k' && chunkData[7] == 0)
                foreach (EvtxEventRecord record in ExtractRecordsFromChunk(chunkData))
                    yield return (record, chunkIndex);

            chunkStart += EvtxChunkHeader.ChunkSize;
            chunkIndex++;
        }
    }

    private EvtxFileHeader ReadFileHeader()
    {
        byte[] headerData = _reader.ReadBytes(EvtxFileHeader.HeaderBlockSize);
        if (headerData.Length < EvtxFileHeader.HeaderBlockSize)
            throw new InvalidDataException("File too small for EVTX header");

        EvtxFileHeader header = new();
        using MemoryStream ms = new(headerData);
        using BinaryReader br = new(ms);

        header.Signature = br.ReadBytes(8);
        header.FirstChunkNumber = br.ReadUInt64();
        header.LastChunkNumber = br.ReadUInt64();
        header.NextRecordId = br.ReadUInt64();
        header.HeaderSize = br.ReadUInt32();
        header.MinorVersion = br.ReadUInt16();
        header.MajorVersion = br.ReadUInt16();
        header.HeaderBlockSizeField = br.ReadUInt16();
        header.ChunkCount = br.ReadUInt16();

        // Skip 76 bytes of unknown
        ms.Position = 120;
        header.FileFlags = br.ReadUInt32();
        header.Checksum = br.ReadUInt32();

        // Validate signature
        if (!header.HasValidSignature())
            throw new InvalidDataException("Invalid EVTX file signature (expected 'ElfFile\\0')");

        // Validate checksum (CRC32 of first 120 bytes)
        uint computed = Crc32.Compute(headerData, 0, 120);
        if (computed != header.Checksum)
            // Log warning but don't fail - some files have bad checksums
            Console.Error.WriteLine(
                $"WARNING: File header checksum mismatch (expected 0x{header.Checksum:X8}, got 0x{computed:X8})");

        return header;
    }

    private EvtxChunk? ReadChunk(int chunkIndex)
    {
        byte[] chunkData = _reader.ReadBytes(EvtxChunkHeader.ChunkSize);
        if (chunkData.Length < EvtxChunkHeader.ChunkSize)
            return null;

        EvtxChunkHeader header = ParseChunkHeader(chunkData);
        if (!header.HasValidSignature())
            return null; // Skip invalid chunks

        EvtxChunk chunk = new()
        {
            ChunkIndex = chunkIndex,
            Header = header,
            RawData = chunkData
        };

        // Validate chunk checksums
        ValidateChunkChecksums(chunkData, header);

        // Extract event records
        chunk.EventRecords.AddRange(ExtractRecordsFromChunk(chunkData));

        return chunk;
    }

    private EvtxChunkHeader ParseChunkHeader(byte[] chunkData)
    {
        EvtxChunkHeader header = new();
        using MemoryStream ms = new(chunkData);
        using BinaryReader br = new(ms);

        header.Signature = br.ReadBytes(8);
        header.FirstEventRecordNumber = br.ReadUInt64();
        header.LastEventRecordNumber = br.ReadUInt64();
        header.FirstEventRecordId = br.ReadUInt64();
        header.LastEventRecordId = br.ReadUInt64();
        header.HeaderSizeField = br.ReadUInt32();
        header.LastEventRecordDataOffset = br.ReadUInt32();
        header.FreeSpaceOffset = br.ReadUInt32();
        header.EventRecordsChecksum = br.ReadUInt32();

        // Skip unknown 64 bytes + 4 bytes unknown flags
        ms.Position = 124;
        header.HeaderChecksum = br.ReadUInt32();

        // Read common string offset array (64 x uint32 at offset 128)
        ms.Position = 128;
        for (int i = 0; i < 64; i++)
            header.CommonStringOffsets[i] = br.ReadUInt32();

        // Read template pointers (32 x uint32 at offset 384)
        ms.Position = 384;
        for (int i = 0; i < 32; i++)
            header.TemplatePointers[i] = br.ReadUInt32();

        return header;
    }

    private void ValidateChunkChecksums(byte[] chunkData, EvtxChunkHeader header)
    {
        // Header checksum: CRC32 of bytes 0-119 AND bytes 128-511
        uint headerCrc = Crc32.Compute(chunkData, (0, 120), (128, 384));
        if (headerCrc != header.HeaderChecksum) Console.Error.WriteLine("WARNING: Chunk header checksum mismatch");

        // Event records checksum: CRC32 of bytes 512 through FreeSpaceOffset
        if (header.FreeSpaceOffset > EvtxChunkHeader.HeaderSize && header.FreeSpaceOffset <= EvtxChunkHeader.ChunkSize)
        {
            int dataLen = (int)header.FreeSpaceOffset - EvtxChunkHeader.HeaderSize;
            uint dataCrc = Crc32.Compute(chunkData, EvtxChunkHeader.HeaderSize, dataLen);
            if (dataCrc != header.EventRecordsChecksum)
                Console.Error.WriteLine("WARNING: Chunk event records checksum mismatch");
        }
    }

    private List<EvtxEventRecord> ExtractRecordsFromChunk(byte[] chunkData)
    {
        List<EvtxEventRecord> records = new();
        int pos = EvtxChunkHeader.HeaderSize; // Records start after 512-byte header

        // Read FreeSpaceOffset to know where records end
        uint freeSpace = BitConverter.ToUInt32(chunkData, 48);
        int endPos = (int)Math.Min(freeSpace, EvtxChunkHeader.ChunkSize);

        while
            (pos + 24 < endPos) // Minimum record size: signature(4) + size(4) + id(8) + timestamp(8) = 24, plus sizecopy
        {
            // Check for record signature
            uint sig = BitConverter.ToUInt32(chunkData, pos);
            if (sig != EvtxEventRecord.ExpectedSignature)
                break;

            uint size = BitConverter.ToUInt32(chunkData, pos + 4);
            if (size < 28 || pos + size > endPos) // minimum viable record
                break;

            EvtxEventRecord record = new()
            {
                Signature = sig,
                Size = size,
                EventRecordId = BitConverter.ToUInt64(chunkData, pos + 8),
                Timestamp = BitConverter.ToInt64(chunkData, pos + 16),
                SizeCopy = BitConverter.ToUInt32(chunkData, pos + (int)size - 4)
            };

            // Extract binary XML data (offset 24 to end - 4)
            int xmlStart = pos + 24;
            int xmlLength = (int)size - 28; // 24 header + 4 trailing size
            if (xmlLength > 0)
            {
                record.BinaryXmlData = new byte[xmlLength];
                Buffer.BlockCopy(chunkData, xmlStart, record.BinaryXmlData, 0, xmlLength);
            }

            records.Add(record);
            pos += (int)size;
        }

        return records;
    }
}