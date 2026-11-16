import random

import main


def test_reseeds_random_once_per_instance(monkeypatch):
    calls: list[tuple] = []
    monkeypatch.setattr(main, "_random_reseeded", False)
    monkeypatch.setattr(random, "seed", lambda *args: calls.append(args))

    main.reseed_random_after_restore()
    main.reseed_random_after_restore()

    assert calls == [()]
