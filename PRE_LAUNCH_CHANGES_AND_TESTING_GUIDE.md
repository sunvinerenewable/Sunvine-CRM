# 🚀 Sunvine Dealer Portal — Complete Pre-Launch Changes & Testing Guide (Hinglish)

> **Branch**: `fix/all-prelaunch`  
> **Target PR**: [PR #2 (devlopment)](https://github.com/sunvinerenewable/Sunvine-CRM/pull/2)  
> **Database Status**: Staging Supabase (`voyargkmlkrlidyxjcbk`) fully migrated & verified (0 Violations)

---

## 📌 1. Short Summary (Asaan Bhasha Mein)

Humne pure portal ko **Production-Ready & Hack-Proof** banaya hai. 
Pehle bohot saari cheezein **frontend ke andar hardcode** thi, database mein **RLS (Row Level Security) khula tha** jisse koi bhi anonymous user data dekh sakta tha, aur direct browser se database update ho raha tha.

Ab:
1. **Single Source of Truth (Database First)**: Har ek pricing, company details, GST rates, aur margin rules seedhe Database se aayenge. Hard refresh (`Ctrl + Shift + R`) karne par koi bhi data gayab nahi hoga.
2. **Zero Anonymous Leaks (RLS Lockdown v2)**: Database ki saari 13 sensitive tables (dealers, staff, quotations, customer files, settings) anonymous users ke liye 100% block ho chuki hain. Sirf authenticated backend API hi inko access kar sakti hai.
3. **Multi-Tenant Security (No IDOR)**: Ek dealer kisi doosre dealer ka quotation ya customer file na dekh sakta hai, na edit ya delete kar sakta hai.
4. **Vercel Hobby Tier Compliant**: API folder mein total 12 serverless endpoints maintain kiye gaye hain taaki deployment bina kisi extra cost ya error ke chale.

---

## 🔄 2. Pehle Kya Ho Raha Tha vs Ab Kaise Kaam Karega? (Before vs After)

| Feature / Area | ❌ Pehle (Before) | ✅ Ab (After - New PR) |
| :--- | :--- | :--- |
| **Authentication & Session** | Browser ka `localStorage` dekh kar role decide hota tha. Agar localStorage mein role change kar do toh fake UI open ho sakti thi. | Har page refresh par server secure HttpOnly cookie / Bearer JWT verify karta hai (`/api/auth/verify`). Database se check hota hai ki account `active` hai ya `suspended`. |
| **Password & Logins** | Default passwords jaise `admin123`, `dealer123` aur hardcoded backdoor RPC (`verify_user_credentials`) the. | Saare backdoor RPCs delete kar diye gaye hain. Har password **Bcrypt (Salt 12)** se hashed hai aur minimum 10 characters enforce karta hai. |
| **Rate Limiting & Brute Force** | Koi bhi hacker unlimited wrong password try kar sakta tha. | **Per-Account Rate Limiter** active hai: agar 5 baar galat password dala toh account agle 15 minutes ke liye lock ho jayega. |
| **Company Details (PDF & Quotes)** | Company GSTIN, Bank account number, Address, WhatsApp number frontend files mein hardcode the. | Sab kuch `system_settings` table se dynamically load hota hai. Admin settings mein change karega toh turant quotes aur PDF mein naya address/bank detail dikhega. |
| **Pricing & Margin Caps** | Frontend par hardcoded ₹6,000 margin cap, ₹18/Wp rate, aur ₹78,000 subsidy ke logic the. | Pure system mein **Dynamic Tier Margins** (`dealer_custom_pricing`) aur PM Surya Ghar policy slabs DB se aate hain. Backend server har ek line item ko khud calculate aur verify karta hai. |
| **BOM & Discounts** | User client-side discount tamper karke ₹100,000+ discount de sakta tha. | Server har quotation save request par catalogue se rate check karta hai aur discount ko maximum **5% of gross cost** par automatically clamp/limit kar deta hai. |
| **File Storage & Uploads** | Koi bhi user kisi bhi doosre user ki files delete ya download kar sakta tha. Files 10MB+ upload ho rahi thi. | Har file upload par **Tenant Isolation** (`role/userId/filename`) lag gaya hai. Allowed formats strictly **PDF, JPG, PNG, WebP** hain aur **Max Size 2MB** enforced hai. |
| **Database Access (RLS)** | Frontend se direct `supabase.from('dealers').insert()` call hota tha jo unsafe tha. | Browser se direct mutations band hain. Saare actions backend APIs (`/api/*`) ke through secure service-role se hote hain. Sensitive tables par anonymous access **Zero** hai. |
| **Realtime Subscriptions** | AppContext mein sensitive tables par open realtime listeners the jo anonymous leak ke time fail hote the. | Insecure public realtime hata diya gaya hai. Realtime public catalogue updates ke liye rehta hai, aur sensitive data authenticated window focus / API fetch se refresh hota hai. |

---

## 🎨 3. UI & Visual Changes (Frontend Par Kya Badla?)

Visual layout aur brand theme (`#0D1527`, emerald/teal colors) ko bilkul disturb nahi kiya gaya hai, par usability aur security enhance hui hai:

1. **Admin Settings (`AdminSettings.jsx`)**:
   - Form ke andar default placeholder `admin123` hata kar **`Min 10 characters`** kar diya gaya hai.
   - Company Profile tab ab live `system_settings` DB se sync hota hai.
2. **Quotation Creation & Review (`CreateQuotation.jsx` & `QuotationPreview.jsx`)**:
   - Dealer ka margin ceiling uske assigned tier ke mutabik dynamically calculate hota hai.
   - PDF aur Print view mein company name, GST, bank account aur phone numbers database settings se render hote hain.
3. **Dealer & Staff Management (`DealerManagement.jsx` & `StaffManagement.jsx`)**:
   - Password reset input par strict 10-character validation add kiya gaya hai.
   - Sensitive password hashes UI state ya network responses mein kabhi expose nahi hote.
4. **Error Boundary & Crash Logging**:
   - Customer data aur sensitive stack traces `localStorage` mein dump hona band ho gaye hain.
   - Client errors safe sanitized format mein backend error reporter ko dispatch hote hain.

---

## 🧪 4. Manual Testing Checklist (Aapko Kya-Kya Test Karna Hai)

Staging environment par in 7 tests ko manually verify karein:

---

### ✅ Test Case 1: Super Admin Login & Dynamic Company Profile
1. Portal open karein aur Admin login page par jayein.
2. Login karein: `admin@sunvinerenewable.com` / `SunvineAdmin@2026`.
3. **Admin Settings → Company Profile** tab mein jayein.
4. Company ka address, contact number ya bank details update karke **Save** dabayein.
5. Page ko hard refresh karein (`Ctrl + Shift + R`).
6. **Expectation**: Saara data database se wapis load hona chahiye, koi bhi field purani ya blank nahi honi chahiye.

---

### ✅ Test Case 2: Dealer Quotation Creation & Dynamic Pricing
1. Dealer account se login karein.
2. **Create Quotation** par click karein.
3. System capacity choose karein (e.g. 5.5 kW).
4. Check karein ki:
   - Module aur Inverter list live catalogue se aa rahi hai.
   - PM Surya Ghar subsidy slab accurately display ho raha hai (e.g. 3kW tak ₹78,000).
   - Dealer margin uske allowed tier cap se upar enter karne par alert ya clamp ho raha hai.
5. Quotation save karein aur PDF preview dekhein.
6. **Expectation**: PDF header aur footer mein Test Case 1 mein set ki gayi dynamic company details aur bank info render honi chahiye.

---

### ✅ Test Case 3: Discount Clamping & Pricing Integrity
1. Quotation banate waqt Custom Discount mein bohot bada number dalein (e.g. ₹50,000).
2. Save request send karein.
3. **Expectation**: Backend server discount ko maximum 5% of gross turnkey cost par clamp kar dega aur quotation total tamper-proof calculate hoga.

---

### ✅ Test Case 4: Customer File Creation & Document Upload
1. Dealer Portal mein **New Application / Customer File** par click karein.
2. Consumer Number, Name, City, aur Sanctioned Load enter karein.
3. Documents section mein ek 1 MB ka valid PDF/JPG upload karein.
4. Phir ek 5 MB se badi file ya `.exe` / `.bat` file upload karne ki koshish karein.
5. **Expectation**:
   - Valid file successfully upload hogi aur tenant prefix folder mein store hogi.
   - Oversized (>2MB) ya invalid format file par turant validation error aayega.

---

### ✅ Test Case 5: Rate Limiting & Account Lockout
1. Login screen par kisi bhi email/mobile ke saath **5 baar galat password** dalein.
2. 5th attempt ke baad 6th time submit karein.
3. **Expectation**: Screen par uniform message aayega aur account agle 15 minutes ke liye temporary lock ho jayega.

---

### ✅ Test Case 6: Cross-Dealer Tenant Protection (IDOR Check)
1. Dealer 1 ke account se ek Quotation ya File create karein aur uska ID note karein (e.g. `SV-2026-Q801`).
2. Logout karke Dealer 2 ke account se login karein.
3. URL ya API ke through Dealer 1 ka quotation load ya edit karne ki koshish karein.
4. **Expectation**: Server turant `403 Forbidden` return karega aur doosre dealer ka data display nahi hoga.

---

### ✅ Test Case 7: Hard Refresh & State Persistence
1. Kisi bhi portal screen (Admin Dashboard, Dealer Applications, Quotations list) par data dekhein.
2. Browser mein **`Ctrl + Shift + R` (Hard Reload)** dabayein.
3. **Expectation**: 
   - User logged in rahega.
   - Screen blank ya crash nahi hogi.
   - Data direct Supabase DB se seamlessly reload hoga.

---

## 📊 5. Automated Test & Build Status

- **Unit & Integration Tests**: `88/88 Passed` (10 test suites, 0 failures)
- **Vite Production Build**: `Passed in 18.65s` (0 errors)
- **NPM Security Audit**: `0 vulnerabilities`
- **Staging Database Probe**: `25/25 checks passed` (0 anonymous read/write violations)
- **Vercel Serverless Function Count**: `12 endpoints` (Strictly within Hobby limit)

---

## 🔗 Next Steps
- PR check karein: **[GitHub Pull Request #2](https://github.com/sunvinerenewable/Sunvine-CRM/pull/2)**
- Apne Vercel Staging environment variables mein naye staging database keys add karein.
- Team ke sath manual test cases run karke review complete karein.
