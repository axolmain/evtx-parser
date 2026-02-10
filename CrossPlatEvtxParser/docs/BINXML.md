# Binary XML Format

All integers are little-endian. All strings are UTF-16LE.

## Token Types

```
0x00  EOF                   - End of fragment. No payload.
0x01  OpenStartElement      - Element with no attributes
0x02  CloseStartElement     - Marks end of element opening section (before children)
0x03  CloseEmptyElement     - Element has no children (self-closing)
0x04  EndElement            - Element closing tag. No payload.
0x05  Value                 - Typed value
0x06  Attribute             - Named attribute
0x07  CDataSection          - CDATA text block
0x08  CharRef               - Character reference (&#xNNNN;)
0x09  EntityRef             - Entity reference (&name;)
0x0A  PITarget              - Processing instruction target
0x0B  PIData                - Processing instruction data
0x0C  TemplateInstance      - Template with substitution values
0x0D  NormalSubstitution    - Placeholder: "use value at index N"
0x0E  OptionalSubstitution  - Placeholder: "use value at index N, or omit if null"
0x0F  FragmentHeader        - Fragment version info

0x41  OpenStartElementAttrs - Element WITH attributes (0x01 | 0x40)
0x45  ValueMore             - Value with more data following
0x46  AttributeMore         - Attribute with more data following
```

Bit 0x40 means "has more data" or "has attributes" depending on context.

## Token Payloads (byte-by-byte)

### FragmentHeader (0x0F)

```
[0x0F] [major:1] [minor:1] [flags:1]
```

Typically: 0x0F 0x01 0x01 0x00

### Element (0x01 or 0x41)

```
[token:1] [dependencyId:2] [dataSize:4] [nameOffset:4]
```

- dependencyId: usually 0xFFFF (none)
- dataSize: size of everything that follows in this element (name, attrs, children, end tag)
- nameOffset: offset from chunk start to the Name structure

Then if 0x41: attribute tokens follow until a non-attribute token.
Then: CloseStartElement (0x02) or CloseEmptyElement (0x03).
Then if 0x02: child tokens follow until EndElement (0x04).

### Name Structure (at the offset)

```
[nextStringOffset:4] [hash:2] [charCount:2] [utf16Data:charCount*2] [nullTerm:2]
```

Total: 8 + charCount*2 + 2 bytes

### Attribute (0x06)

```
[0x06] [nameOffset:4]
```

Value token usually follows immediately.

### Value (0x05)

```
[0x05] [valueType:1] [dataSize:2] [data:dataSize]
```

### Substitution (0x0D normal, 0x0E optional)

```
[token:1] [substitutionId:2] [valueType:1]
```

substitutionId is the 0-based index into the template instance's substitution values array.

### CData (0x07)

```
[0x07] [size:2] [utf16Data:size]
```

### CharRef (0x08)

```
[0x08] [charValue:2]
```

### EntityRef (0x09)

```
[0x09] [nameOffset:4]
```

## Template Instance (0x0C) - THE COMPLEX ONE

This is the most critical token. Almost every EVTX event record is a template instance.

### Layout in the byte stream

```
[0x0C]                          -- 1 byte: token
[unknown:1]                     -- 1 byte: always 0x01
[templateDefOffset:4]           -- 4 bytes: offset from chunk start to template definition

--- IF FIRST ENCOUNTER (template not yet cached): ---
    The template definition data sits inline at templateDefOffset.
    The parser jumps to that offset and reads the definition.
    After parsing, _pos is past the definition, at the substitution data.

--- IF ALREADY CACHED: ---
    _pos is already right after the 6-byte instance header.
    The substitution data follows immediately.

--- SUBSTITUTION INSTANCE DATA (always follows): ---
[substitutionCount:4]           -- 4 bytes: number of substitution values
For each substitution:
  [size:2]                      -- 2 bytes: byte size of this value (0 = null)
  [type:1]                      -- 1 byte: BinXmlValueType
For each substitution (in same order):
  [data:size]                   -- size bytes of value data (skipped if size=0)
```

### Template Definition Data (at templateDefOffset)

```
[nextTemplateDefOffset:4]       -- 4 bytes: offset to next template def (0 if none)
[templateGuid:16]               -- 16 bytes: GUID identifying this template
[dataSize:4]                    -- 4 bytes: size of the BinXml content below
[BinXml content: dataSize]      -- Fragment header + element tree + EOF
```

The BinXml content inside the template definition contains the element structure
with Substitution tokens (0x0D/0x0E) as placeholders where real values go.

### How Templates Work End-to-End

1. Parser encounters 0x0C token in event record's BinXml
2. Reads unknown byte + templateDefOffset
3. First time: jumps to offset, reads definition (nextOffset + GUID + dataSize + fragment)
    - The fragment contains elements like `<Event><System><Provider Name="[Sub:0]"/>...`
    - Substitution nodes (0x0D) mark where runtime values go
4. Reads substitution count + descriptors + value data
5. Produces BinXmlTemplateInstanceNode with:
    - TemplateElement: the element tree (with SubstitutionNode placeholders)
    - SubstitutionValues: the actual values to fill in
6. During rendering, XmlRenderer resolves each SubstitutionNode by looking up
   SubstitutionValues[substitutionId] and writing its string representation

### Example

Template definition element tree:

```xml
<Event>
  <System>
    <Provider Name="[Sub:0]" Guid="[Sub:1]"/>
    <EventID>[Sub:2]</EventID>
    <Level>[Sub:3]</Level>
    <Channel>[Sub:10]</Channel>
    <Computer>[Sub:11]</Computer>
  </System>
  <EventData>
    <Data Name="ProcessName">[Sub:12]</Data>
  </EventData>
</Event>
```

Substitution values for one record:

```
[0] = "Microsoft-Windows-Security-Auditing"
[1] = "{guid}"
[2] = 4688
[3] = 0
...
[10] = "Security"
[11] = "WORKSTATION01"
[12] = "C:\Windows\System32\cmd.exe"
```

Rendered XML:

```xml
<Event>
  <System>
    <Provider Name="Microsoft-Windows-Security-Auditing" Guid="{guid}"/>
    <EventID>4688</EventID>
    ...
  </System>
</Event>
```

## Value Types

```
0x00  Null         0 bytes
0x01  String       variable, UTF-16LE
0x02  AnsiString   variable, ASCII
0x03  Int8         1 byte
0x04  UInt8        1 byte
0x05  Int16        2 bytes
0x06  UInt16       2 bytes
0x07  Int32        4 bytes
0x08  UInt32       4 bytes
0x09  Int64        8 bytes
0x0A  UInt64       8 bytes
0x0B  Real32       4 bytes (IEEE 754 float)
0x0C  Real64       8 bytes (IEEE 754 double)
0x0D  Bool         4 bytes (uint32, 0=false)
0x0E  Binary       variable, raw bytes
0x0F  Guid         16 bytes
0x10  SizeT        4 or 8 bytes
0x11  FileTime     8 bytes (100ns ticks since 1601-01-01 UTC)
0x12  SystemTime   16 bytes (8 x uint16: year,month,dow,day,hour,min,sec,ms)
0x13  Sid          variable (revision:1, subAuthCount:1, authority:6, subAuths:4*N)
0x14  HexInt32     4 bytes, displayed as 0xNNNNNNNN
0x15  HexInt64     8 bytes, displayed as 0xNNNNNNNNNNNNNNNN
0x21  BinXml       variable, nested binary XML fragment
```

Array types have bit 0x80 set (e.g., StringArray = 0x81).

## Element Parsing Flow

```
                   OpenStartElement (0x01 or 0x41)
                   read: dependencyId, dataSize, nameOffset
                          |
            +--- has attributes? (0x41) ---+
            |                              |
            v                              v
    Parse Attribute tokens           (no attributes)
    until non-Attribute                    |
            |                              |
            +------------------------------+
                          |
                    read next token
                          |
              +-----------+-----------+
              |                       |
     CloseStartElement (0x02)  CloseEmptyElement (0x03)
     -> parse children              -> return (no children)
     until EndElement (0x04)
              |
        return element
```
