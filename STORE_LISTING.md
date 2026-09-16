# Priya ki Dost (Mayra) — Play Store Listing Draft

## Permissions justification (Data safety / Play Protect)

### Contacts (READ_CONTACTS)
> Contacts access is used only to find the right person when you ask Mayra to call or message someone by name — contact data is never uploaded or shared anywhere.

Contacts are read on-device only, at the moment you ask Mayra to "call Rahul" or
"WhatsApp Mummy ko message bhejo". The matched phone number is used to open the
dialer (pre-filled, you tap call) or the WhatsApp chat (pre-typed, you tap Send).
Mayra never auto-dials, never auto-sends, and never transmits your contacts to any
server.

### Microphone (RECORD_AUDIO)
Used for real-time voice conversation with Mayra (Gemini Live). Audio streams to the
selected AI provider only while a voice session is active.

### Location (ACCESS_FINE/COARSE_LOCATION)
Used only when you ask about the weather, to fetch the local forecast. Not tracked in
the background.

### Notifications (POST_NOTIFICATIONS)
Optional. Reserved for future gentle reminders; no active notifications are sent today.

## Not requested
- Call Phone (CALL_PHONE): Mayra only opens the dialer (ACTION_DIAL); it never places
  a call by itself, so this permission is intentionally not requested.
