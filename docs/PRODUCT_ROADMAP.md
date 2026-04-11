# VillageStock — Product overview & roadmap

**Audience:** Shop owners and staff at multi-counter electronics retailers (e.g. Computer Village–style operations).  
**Format:** What you can use today, what we consider **core (MVP)** vs **enhanced**, and what is **planned next**.

---

## What you can use today


| Area                  | Capabilities                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Accounts**          | Sign in with phone and/or email; password reset; staff invited by email with their own login.                     |
| **Shop setup**        | Onboarding for shop details;14-day trial; shop profile for receipts (name, address, phone, logo).                 |
| **Branches**          | Multiple locations; switch branch in the app; move stock between branches.                                        |
| **Team**              | Owner, manager, and staff roles; limit people to specific branches; invite or add teammates.                      |
| **Inventory**         | Serialized items (phones, laptops, tablets) and quantity-based accessories/parts; IMEI/serial, condition, status. |
| **Sales**             | Record sales (cash, transfer, POS); credit sales with customer and due date; swaps with trade-in; receipts.       |
| **Returns & credits** | Returns linked to sales; track credit balances and payments.                                                      |
| **Repairs**           | Send units out for repair; track status and engineer.                                                             |
| **Stock sessions**    | Opening/closing stock sessions for reconciliation (business-focused workflow).                                    |
| **Reports**           | Performance reporting and exports (see in-app Reports).                                                           |
| **Audit**             | Activity log of key actions (who did what, in plain language).                                                    |
| **Reliability**       | Works offline-first on the device; syncs to the cloud when online.                                                |
| **Install**           | Installable as a web app (PWA) on phone or desktop.                                                               |


---

## MVP (core) vs enhanced**MVP — minimum valuable product** (run a real shop day-to-day):

- Auth, onboarding, shop profile  
- Branches + branch switching  
- Inventory (both serialized and bulk)  
- Sales (paid + basic credit), receipts- Team roles and branch limits for staff  
- Cloud sync and offline tolerance**Enhanced** (differentiation and scale):
- Full **credits** lifecycle and richer **returns**  
- **Swaps** and trade-in on receipts  
- **Repairs** workflow  
- **Stock sessions** (open/close, detail views)  
- **Reports** beyond the dashboard  
- **Audit log** for accountability  
- **Admin console** for operators supporting many businesses  
- PWA install

---

## Planned / in progress (from product direction in app)

These are called out in the product UI or codebase; timelines depend on your deployment.


| Item                              | Note                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- |
| **Live subscriptions (Paystack)** | Billing UI exists; live payment collection is the next step for paid plans.       |
| **Email confirmations**           | Configurable in Supabase; shops should set redirect URLs for local vs production. |
| **Deeper analytics**              | Extend reports as you gather usage feedback.                                      |


---

## For buyers & partners

- **Data:** Retail data is scoped per shop with role-based access; audit events support accountability.  
- **Stack:** Web app + Supabase (database, auth, edge functions); suitable for managed hosting and regional compliance discussions with your team.

---

*Last updated from the repository feature inventory. Adjust sections as you ship.*