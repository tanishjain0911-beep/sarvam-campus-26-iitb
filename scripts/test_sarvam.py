"""Run with Python in a terminal; your key is hidden and never saved."""
import getpass
import json
import re
import sys
import urllib.error
import urllib.request


def main():
    key = getpass.getpass("Paste your replacement Sarvam API key (hidden): ").strip()
    if not key:
        print("No key entered. No request sent.")
        return 1
    payload = {
        "model": "sarvam-105b",
        "messages": [{"role": "user", "content": "Say hello to an IIT Bombay hackathon participant in one short sentence."}],
    }
    request = urllib.request.Request(
        "https://api.sarvam.ai/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "api-subscription-key": key},
        method="POST",
    )
    print("Sending one small test request to Sarvam...")
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        choice = result["choices"][0]
        content = choice["message"].get("content")
        if isinstance(content, str) and content.strip():
            print("\nAPI test succeeded:")
            print(content)
        else:
            print("\nConnection and API authentication succeeded.")
            print("Sarvam returned no reply text.")
            print("Finish reason:", json.dumps(choice.get("finish_reason")))
            print("Your API key is ready for the build-along.")
        return 0
    except urllib.error.HTTPError as error:
        hints = {
            400: "Sarvam rejected the request. See its message below.",
            401: "Check that your replacement key is correct.",
            403: "Check the key and its access in the Sarvam dashboard.",
            429: "Check available credits and rate limits, then retry later.",
        }
        print(f"Request failed (HTTP {error.code}). " + hints.get(error.code, "Check Sarvam's service status or try again later."))
        detail = error.read(16384).decode("utf-8", errors="replace")
        detail = detail.replace(key, "[KEY REDACTED]")
        detail = re.sub(r"sk_[A-Za-z0-9_-]+", "[KEY REDACTED]", detail)
        # Escape control characters before displaying server text in the terminal.
        print("Sarvam error:", json.dumps(detail[:3000], ensure_ascii=True))
    except urllib.error.URLError:
        print("Could not connect. Check your internet connection and retry.")
    except (KeyError, IndexError, ValueError):
        print("Received an unexpected response. Share the error description, not your key.")
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (KeyboardInterrupt, EOFError):
        print("\nCancelled.")
        sys.exit(1)
