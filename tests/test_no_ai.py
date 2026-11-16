"""Fork guard: no AI at runtime. The bridge must never start a Claude process."""
import asyncio, os, subprocess, sys, unittest
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "bridge"))


class NoAi(unittest.TestCase):
    def test_ask_is_off_even_with_a_claude_binary(self):
        os.environ["CLAUDE_BIN"] = sys.executable   # pretend a claude binary exists
        import config
        self.assertFalse(config.ASK_ENABLED)

    def test_run_claude_never_spawns(self):
        import claude
        called = []
        real = asyncio.create_subprocess_exec
        asyncio.create_subprocess_exec = lambda *a, **k: called.append(a)
        try:
            with self.assertRaises(RuntimeError):
                asyncio.run(claude.run_claude("hi"))
        finally:
            asyncio.create_subprocess_exec = real
        self.assertEqual(called, [])

    def test_background_loop_returns_at_once(self):
        import claude
        asyncio.run(asyncio.wait_for(claude.background_loop(), 2))


if __name__ == "__main__":
    unittest.main()
