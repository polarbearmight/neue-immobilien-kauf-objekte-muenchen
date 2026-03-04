def in_bucket(value, bucket):
    if value is None:
        return bucket == "unknown" or bucket == "all"
    if bucket == "9000":
        return value <= 9000
    if bucket == "12000":
        return value <= 12000
    if bucket == "all":
        return True
    return False


def test_buckets():
    assert in_bucket(8500, "9000")
    assert not in_bucket(9500, "9000")
    assert in_bucket(9500, "12000")
    assert in_bucket(None, "unknown")
