from collectors.run_collect import COLLECTOR_MAP


def test_collector_registry_has_core_sources():
    # Core wave integrated in codebase (activation still manual/approval-gated)
    assert {"sz", "is24", "immowelt", "ohne_makler", "wohnungsboerse", "sis", "planethome"}.issubset(set(COLLECTOR_MAP.keys()))
