# Test TODOs

- Add exact-value assertions for chunk 0 of security.evtx (pin records 1-91, free space 65376, checksums, etc. like the
  Rust parser does)
- Add corrupted header resilience test once EvtxChunk iteration exists (inflate last_event_record_id and
  free_space_offset, verify iteration still completes cleanly)

## EvtxChunk.ValidateChunk()

Add a validation method that returns a list of warnings. Key checks:

- Record count matches expected (lastEventRecordId - firstEventRecordId + 1)
- Record IDs are sequential (no gaps)
- Size == SizeCopy for each record
- BinXml payload starts with 0x0F (FragmentHeader token)
- BinXml payload is non-empty and not suspiciously small (< 4 bytes)
- WrittenTime is non-zero for each record
- Dirty flag noted as warning (benign, e.g. unclean shutdown)
