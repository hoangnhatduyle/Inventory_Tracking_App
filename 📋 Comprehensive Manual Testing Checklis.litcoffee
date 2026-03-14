📋 Comprehensive Manual Testing Checklist
Here's the full testing checklist from the plan. Use these to systematically verify all fixes:

1. Authentication (11 tests)
✅ Register new user → success toast → auto-login
✅ Register with existing username → error message
✅ Register with mismatched passwords → validation error
✅ Register with blank/whitespace username → validation error
✅ Login with correct credentials → lands on Dashboard
✅ Login with wrong password → error message, button re-enables 🤖
✅ Login with wrong username → error message
✅ Logout → redirects to Login page (not Dashboard) 🤖
✅ After logout, pressing back does NOT return to authenticated pages
✅ Close app while logged in → re-open → still logged in (30-day session)
✅ Manually corrupt localStorage session token → app redirects to Login (no infinite loop) 🤖

2. Dashboard (8 tests)
☐ Dashboard loads statistics: Total Items, Total Value, Expiring Soon, Expired
☐ Total Value reflects current stock quantity (not original purchase quantity) 🤖
☐ "Expiring Soon" count shows items expiring within 7 days but NOT already expired
☐ Board view groups items correctly by location
☐ Switching between Stats and Board view works
☐ Recipe suggestions appear when items are expiring
☐ Low stock items panel loads in background without blocking the page
☐ Low stock percentage uses per-item threshold setting (not always 20%) 🤖

3. Inventory — Item List (16 tests)
☐ Items load on page entry
☐ Search by name filters list in real-time
☐ Filter by category works
☐ Filter by location works
☐ Filter by status (Fresh / Expiring Soon / Expired) works
☐ "Expiring Soon" filter does NOT include already-expired items 🤖
☐ Sort by: Expiration Date, Name, Quantity, Recently Added — all work
☐ Card view and Table view both display data correctly
☐ Barcode search (scan or type) finds items 📱
☐ Delete single item → removed from list
☐ Multi-select mode → select multiple → delete all → confirms → items removed
☐ Multi-select mode → delete fails → select mode resets, list refreshes 🤖
☐ Mark item as wasted → item removed from inventory → appears in Waste Tracking
☐ Record usage → dialog opens → enter amount → confirms → quantity decrements 📱 🤖
☐ Record usage → enter full amount → Empty Item dialog appears
☐ Empty Item dialog → "Refill" → Refill dialog opens / "Remove" → item deleted
☐ Record usage more than available → appropriate error or capped at zero

4. Inventory — Batch Tracking 📱 (9 tests)
☐ View Batches dialog shows all batches for an item
☐ Each batch shows correct status: Fresh / Expiring Soon / Expired
☐ Earliest expiration date shown in summary (not just first-inserted)
☐ Refill item → Add mode → quantity adds to existing batches → total increases
☐ Refill item → Replace mode → replaces existing quantity
☐ After refilling, batch is saved with correct ID (not 0) 📱 🤖
☐ Delete individual batch → batch disappears → total updates
☐ FIFO deduction: recording usage deducts from earliest-expiring batch first 📱 🤖
☐ After FIFO deduction, item's current_quantity decrements correctly 📱 🤖
☐ If usage exceeds all batch stock → all batches drained → no over-deduction 🤖

5. Add / Edit Item (14 tests)
☐ Add item form opens with empty fields
☐ Barcode scan auto-fills name, category, price, location (if previously learned) 📱
☐ Unknown barcode → user fills form → on save, barcode is learned for future
☐ Known barcode rescan → updates existing barcode mapping (not duplicate) 📱 🤖
☐ AI expiration suggestion button appears → click → date field auto-populated 📱
☐ AI suggestion with days=0 is rejected 🤖
☐ Custom expiration picker: Days / Weeks / Months / Years all calculate correctly
☐ Custom expiration on leap year boundary calculates correctly
☐ Capture photo from camera → image displayed on item 📱
☐ Select photo from gallery → image displayed 📱
☐ Category selector opens bottom sheet → selection applied
☐ Location selector opens bottom sheet → selection applied
☐ Save item → navigates back → item appears in list
☐ Edit existing item → form loads with correct current values 🤖
☐ Edit item → change fields → save → updated values visible in list
☐ Add item with initialQuantity = 0 → stored as 0, not treated as missing 🤖

6. Shopping List (8 tests)
☐ Shopping list loads items on entry
☐ Add item to shopping list → appears in list
☐ Edit shopping list item → updated
☐ Toggle item purchased → moves to purchased section (or strikethrough)
☐ Clear purchased items → removes all checked items
☐ Delete single item → removed
☐ Export to text → text is formatted correctly
☐ Export with empty unpurchased list → export indicates empty state

7. Waste Tracking (8 tests)
☐ Waste Tracking page loads data (not empty due to async bug) 🤖
☐ Wasted items list shows items with category, quantity, date
☐ Filter by category → list filtered correctly
☐ Filter by time range: Week / Month / Year / All → list filtered correctly
☐ Waste statistics card shows total items wasted and total value lost
☐ Waste by category breakdown shows correct counts
☐ Waste by month chart shows 6 most recent months in chronological order 🤖
☐ Delete a wasted item → removed from list → stats update

8. Settings — Locations (5 tests)
☐ Locations list loads on Settings page entry
☐ Add new location → dialog → save → appears in list
☐ Add location with empty name → validation prevents save
☐ Save location fails → error message shown (not silent) 🤖
☐ Edit existing location → dialog pre-filled → save → updated in list
☐ Delete location → removed from list

9. Settings — Notifications 📱 (7 tests)
☐ Request notification permissions → system dialog appears 📱
☐ Reschedule notifications → success message 📱
☐ Test notification → notification appears in Android notification shade within 1 minute 📱
☐ Item approaching expiration → notification appears on correct day 📱
☐ Item expired → notification appears on expiry day 📱
☐ Low stock item → low-stock notification appears 📱
☐ Low-stock notification does NOT re-fire on every app open (only once per 24h) 📱 🤖

10. Settings — Data Export & Import (5 tests)
☐ Export CSV → file downloaded / shared → open in spreadsheet, data is correct
☐ CSV with items containing commas or quotes → displays correctly in spreadsheet (no injection) 🤖
☐ Export full ZIP backup → file created
☐ Import ZIP backup → double-confirm dialog appears
☐ Import ZIP → data restored → all tables populated in correct order 🤖
☐ Import ZIP with partial file → graceful error, existing data intact

11. Settings — Admin (PIN Protected) (10 tests)
☐ Set PIN → prompt appears → PIN saved
☐ Enter correct PIN → admin sections unlock
☐ Enter wrong PIN → error, sections stay locked
☐ Data Browser → table list shows all app tables
☐ Data Browser → select table → rows displayed with pagination
☐ Data Browser → search → filters rows
☐ Data Browser → edit row → save → row updated
☐ Data Browser → delete row → row removed
☐ Console Viewer → app logs shown
☐ Console Viewer → filter by level / search works
☐ Image Storage Browser → shows saved images

12. Recipe Manager (6 tests)
☐ Recipe list loads (not empty, not crashing if no ingredients) 🤖
☐ Search recipes by name → filters correctly
☐ Add recipe → form → save → appears in list
☐ Edit recipe → form pre-filled → save → updated
☐ Delete recipe → removed
☐ Recipe suggestions on Dashboard match items expiring within 7 days

13. Barcode Scanning (Android Only) 📱 (5 tests)
☐ Camera permission requested on first scan 📱
☐ Scan real barcode → returns correct value 📱
☐ Unknown barcode → item form opens, barcode field pre-filled 📱
☐ Known barcode → item form auto-fills name, category, price, location 📱
☐ Scan same barcode twice → mapping UPDATES, not duplicates 📱 🤖

14. AI Expiration Suggestion (5 tests)
☐ Click AI suggest button → loading indicator → date auto-filled
☐ Item name with common food (e.g. "Milk") → plausible shelf life suggested
☐ Item stored in "Fridge" location → shorter shelf life than "Pantry"
☐ Invalid AI response (days=0) → rejected, user sees error 🤖
☐ After 1000 requests this month → rate limit message shown (not crash)
☐ Failed AI requests do NOT consume monthly quota 🤖

15. Image Handling (Android) 📱 (6 tests)
☐ Take photo → image saved → displayed on item card 📱
☐ Select from gallery → image saved → displayed 📱
☐ PNG image renders correctly (not corrupted as JPEG) 📱 🤖
☐ Delete item with image → image file removed from device storage 📱 🤖
☐ Item with image → edit item → existing image displayed
☐ Item without image → no broken image icon shown

16. Security & Sessions (4 tests)
☐ Password with special characters registers and logs in correctly
☐ Two users with same password have DIFFERENT stored hashes (salt verified) 🤖
☐ Session expires after 30 days → redirected to login
☐ Auth guard on all protected routes: manually navigate to /inventory when logged out → redirect to /login 🤖

17. Cross-Platform Sanity (Web dev only) (6 tests)
☐ npm start → navigate to login → register → login → dashboard loads
☐ Add item → save → item appears in inventory list
☐ Shopping list: add, toggle, delete all work
☐ Settings page → username shows (not [object Promise])
☐ Waste tracking page → loads (not empty)
☐ Batch dialog → "Fresh/Expiring/Expired" labels appear correctly
☐Legend: 🤖 = also covered by unit tests | 📱 = Android-only (cannot test on web)