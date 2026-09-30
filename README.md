# Keychain Print Queue

Submission, print-queue and voting app for the 3D-printed keychain challenge at
[Devin Local: London](https://luma.com/wn0h6ffm). Built on the stack of
[dabit3/vending-machine](https://github.com/dabit3/vending-machine).

- **Participants** (checked-in Luma guests only) upload up to two STL/3MF files,
  pick one to print, request a colour (not guaranteed), and track it through
  queued → printing → done, or read the organizer's rejection comment.
- **Organizers** (`/admin`) upload the Luma guest CSV, review submissions,
  download files with clear names, reject with a comment, and drive the queue.
- **TV** (`/tv`) shows the live queue on the venue screen.
- **Voting** (`/vote`) lets each participant vote for two finished designs.

See `AGENTS.md` for domain rules and local setup.
