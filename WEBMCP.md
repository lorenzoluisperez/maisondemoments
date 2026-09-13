# WebMCP tools

The invitation renderer registers these client-side tools only when `document.modelContext` is available:

| Tool | Input | Effect |
|---|---|---|
| `navigate_invitation_scene` | `{ scene: "opening" \| "welcome" \| "details" \| "participants" \| "rsvp" }` | Scrolls to an available section in the visible synthetic invitation |
| `submit_demo_household_rsvp` | `{ status: "ATTENDING" \| "DECLINED" }` | Updates the synthetic demo household response |

Both tools validate bounded inputs. The RSVP tool is demo-only and does not represent a persisted production write.
