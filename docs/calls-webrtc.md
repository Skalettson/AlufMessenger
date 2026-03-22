# Voice and video calls (WebRTC)

Aluf Messenger supports **1:1 voice and video** using standard **WebRTC**. At a high level:

- **Media path:** Audio and video are protected by **DTLS-SRTP** between clients. Relay servers (if used) forward encrypted packets and do not decrypt conversation content.
- **Signaling:** Session descriptions and ICE candidates are exchanged over the app’s **encrypted signaling channel** (not end-to-end encrypted like message content; this matches common messenger designs).
- **Safety / verification:** The UI can show a short **comparison string** derived from session fingerprints so both parties can confirm they are talking to the same peer (similar in spirit to safety numbers in other messengers).

Operational details (STUN/TURN, environment configuration, or hosting layout) are intentionally **not** covered in this public repository.
