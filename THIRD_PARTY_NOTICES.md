# Third-party notices

This distribution includes Cobalt 2.2.5.15, by deivid and upio, under the Apache License 2.0. Cobalt's preserved license is at `vendor/cobalt/LICENSE.md`. The official source, release version, commit, original SHA-256, and local modifications are recorded in `vendor/cobalt/provenance.json`. The unmodified release is retained as `vendor/cobalt/Cobalt.upstream.luau` in the source distribution.

Cobalt is embedded in `src/application/services/cobalt-bundle.ts` and the compiled server. Local modifications cover callback/handle cleanup, launch-mode selection, a compatibility marker, and exposure of the existing code generator. Original notices and the original release remain intact. Cobalt's bundled dependencies retain their upstream license notices in the release source.

Polaris and the new integration code remain under the project's MIT license. The upstream Cobalt project does not endorse this integration.
