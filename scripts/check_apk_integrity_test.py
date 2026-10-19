import hashlib
import importlib.util
from pathlib import Path
import struct
import sys
import tempfile
import unittest
import zipfile
import zlib

sys.dont_write_bytecode = True
spec = importlib.util.spec_from_file_location("apk_integrity", Path(__file__).with_name("check-apk-integrity.py"))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def dex(payload=b""):
    data = bytearray(112) + payload
    data[:8] = b"dex\n035\0"
    struct.pack_into("<III", data, 32, len(data), 112, 0x12345678)
    data[12:32] = hashlib.sha1(data[32:]).digest()
    struct.pack_into("<I", data, 8, zlib.adler32(data[12:]) & 0xffffffff)
    return bytes(data)


class ApkIntegrityTests(unittest.TestCase):
    def check(self, entries):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.apk"
            with zipfile.ZipFile(path, "w") as archive:
                for name, data in entries:
                    archive.writestr(name, data)
            return checker.check_apk(path)

    def test_valid_multidex(self):
        self.assertEqual(self.check([("classes.dex", dex()), ("classes2.dex", dex(b"second"))]), 2)

    def test_truncated_extra_dex_reproduces_customer_build_failure(self):
        with self.assertRaisesRegex(ValueError, "classes5.dex: truncated DEX"):
            self.check([("classes.dex", dex()), ("classes5.dex", dex(b"interrupted")[:-4])])

    def test_corrupted_payload(self):
        with self.assertRaisesRegex(ValueError, "invalid DEX SHA-1"):
            self.check([("classes.dex", dex(b"original")[:-1] + b"x")])

    def test_bad_checksum(self):
        data = bytearray(dex())
        data[8] ^= 1
        with self.assertRaisesRegex(ValueError, "invalid DEX checksum"):
            self.check([("classes.dex", data)])

    def test_duplicate_payload(self):
        with self.assertRaisesRegex(ValueError, "duplicate DEX payload"):
            self.check([("classes.dex", dex()), ("classes2.dex", dex())])

    def test_missing_primary_dex(self):
        with self.assertRaisesRegex(ValueError, "missing classes.dex"):
            self.check([("assets/index.html", b"hello")])


if __name__ == "__main__":
    unittest.main()
