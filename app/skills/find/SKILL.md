---
name: find
description: Find where something happens in a binary from a plain-English description, the license check, the crypto, the parser, the network call, and open it.
---

# Find where something happens

The user describes a behavior in plain words. Get them to the code that does it.

1. Turn the description into concrete anchors:
   - strings it would use (error messages, URLs, format strings, key names),
   - imports it would call (crypto, network, file, registry, auth),
   - constants (magic numbers, algorithm constants like 0x6a09e667 for SHA-256).
2. Find those anchors with `search_strings` / `list_strings` for text, `find_xrefs_to_name` or a string's xrefs for who uses them, and the imports list for the calls.
3. Follow the xrefs into code. Read the candidates (`procedure_pseudo_code`, or `procedure_assembly`) and confirm which one actually does the thing, not just mentions it.
4. `open_function` (eleven) the best match so it is on screen, `rename_function` and `add_note` it, and bookmark it if the user will come back.

Answer with: where it is (the named function and address), how you know it is the right one, and the two or three steps it takes. If there are several candidates, name the most likely and say why. If the behavior genuinely is not in this binary, say so and what that implies.
