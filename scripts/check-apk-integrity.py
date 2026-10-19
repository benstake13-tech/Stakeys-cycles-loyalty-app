#!/usr/bin/env python3
"""Reject truncated/corrupt DEX and duplicate ZIP entries before shipping an APK."""
import hashlib
import re
import struct
import sys
import zipfile
import zlib


def check_apk(path):
    with zipfile.ZipFile(path) as apk:
        names = apk.namelist()
        if len(names) != len(set(names)):
            raise ValueError("duplicate ZIP entries")
        bad_entry = apk.testzip()
        if bad_entry:
            raise ValueError(f"corrupt ZIP entry: {bad_entry}")
        dex_names = [name for name in names if re.fullmatch(r"classes(?:[2-9]|[1-9][0-9]+)?\.dex", name)]
        if "classes.dex" not in dex_names:
            raise ValueError("missing classes.dex")
        seen = set()
        for name in dex_names:
            data = apk.read(name)
            if len(data) < 112 or not re.fullmatch(rb"dex\n0[0-9]{2}\x00", data[:8]):
                raise ValueError(f"{name}: invalid DEX header")
            size, header_size, endian = struct.unpack_from("<III", data, 32)
            if size != len(data):
                raise ValueError(f"{name}: truncated DEX (declared {size}, actual {len(data)})")
            if header_size != 112 or endian != 0x12345678:
                raise ValueError(f"{name}: invalid DEX layout")
            if hashlib.sha1(data[32:]).digest() != data[12:32]:
                raise ValueError(f"{name}: invalid DEX SHA-1")
            if zlib.adler32(data[12:]) & 0xffffffff != struct.unpack_from("<I", data, 8)[0]:
                raise ValueError(f"{name}: invalid DEX checksum")
            digest = hashlib.sha256(data).digest()
            if digest in seen:
                raise ValueError(f"{name}: duplicate DEX payload")
            seen.add(digest)
        return len(dex_names)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("usage: check-apk-integrity.py <apk>")
        count = check_apk(sys.argv[1])
        print(f"APK integrity OK: {count} complete DEX files")
    except (OSError, ValueError, zipfile.BadZipFile) as error:
        print(f"APK integrity FAILED: {error}", file=sys.stderr)
        sys.exit(1)
