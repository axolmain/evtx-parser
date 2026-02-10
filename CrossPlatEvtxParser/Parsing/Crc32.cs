namespace CrossPlatEvtxParser.Parsing;

/// <summary>
///     CRC32 checksum per RFC 1952, used for EVTX file header and chunk header validation.
/// </summary>
public static class Crc32
{
    private static readonly uint[] Table = GenerateTable();

    private static uint[] GenerateTable()
    {
        uint[] table = new uint[256];
        const uint polynomial = 0xEDB88320u; // reversed polynomial
        for (uint i = 0; i < 256; i++)
        {
            uint crc = i;
            for (int j = 0; j < 8; j++)
                if ((crc & 1) != 0)
                    crc = (crc >> 1) ^ polynomial;
                else
                    crc >>= 1;
            table[i] = crc;
        }

        return table;
    }

    public static uint Compute(byte[] data, int offset, int length)
    {
        uint crc = 0xFFFFFFFF;
        for (int i = offset; i < offset + length; i++) crc = (crc >> 8) ^ Table[(crc ^ data[i]) & 0xFF];
        return crc ^ 0xFFFFFFFF;
    }

    /// <summary>
    ///     Compute CRC32 over multiple non-contiguous byte ranges (used for chunk header).
    /// </summary>
    public static uint Compute(byte[] data, params (int offset, int length)[] ranges)
    {
        uint crc = 0xFFFFFFFF;
        foreach ((int offset, int length) in ranges)
            for (int i = offset; i < offset + length; i++)
                crc = (crc >> 8) ^ Table[(crc ^ data[i]) & 0xFF];

        return crc ^ 0xFFFFFFFF;
    }
}