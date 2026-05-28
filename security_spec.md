# Security Specification: Attribute-Based Access Control & Zero-Trust Architecture

This document contains negative security testing payloads and detailed data invariants to prevent updating or injection vulnerability gaps on all system schemas.

## 1. Core Data Invariants
- Each document must possess a fully valid and conforming alphanumeric ID string (`isValidId()`).
- All sub-entities (e.g., purchase orders, sales orders) may only transition logically or be created when their related parent keys (e.g., source inventory item, warehouseId) are verified to exist or belong to signed-in individuals.
- Immutable fields like `createdAt`, `userId`, or primary key pointers must not undergo modifications during document updates.
- All timestamp updates must be restricted to real-time `request.time` matches.

## 2. The Dirty Dozen Payloads (Targeting Exploitable Gaps)

1. **Self-Elevated Admin Role Profile**
   - Payload: `{ "id": "attackerUid", "email": "attacker@spam.com", "role": "Admin", "permissions": { "canManageUsers": true } }` -> Should be caught by users collection rules prohibiting standard self-assignment of `role` or metadata keys.
2. **Orphaned Sales Order Warehouse ID Leak**
   - Payload: `{ "id": "so_111", "soNumber": "SO-001", "warehouseId": "nonexistent_warehouse_id_for_denial", "items": [] }`
3. **Malicious Long SKU Injection**
   - Payload: `{ "id": "item1", "sku": "A_VERY_LONG_STRING_OVER_CONSTRAINED_SIZE_LIMITATION", "name": "Fake SKU", "status": "Active" }`
4. **Tampering with Finished State Check (Post-Termination Lockout Bypass)**
   - Payload: `{ "id": "po_999", "status": "Cancelled" }` on an already received purchase order document.
5. **PII Blanket Leakage Attempt by Non-Owner**
   - Action: Read from `/users/someoneElseUid`.
6. **Time Travel Clock Attack on Transaction Auditing**
   - Payload: `{ "id": "tx_23", "itemId": "item2", "date": "1999-01-01T00:00:00Z", "quantity": 10 }`
7. **Phantom Field / Ghost Attribute Poisoning**
   - Payload: `{ "id": "wh_10", "name": "Warehouse", "code": "WH10", "status": "Active", "hackerBypassGate": true }`
8. **Spoofing ID String Path Injection**
   - Document Path: `/items/..%2fmalicious--injection-string`
9. **Negative Price/Negative Quantity Reorder Inversion**
   - Payload: `{ "id": "item5", "sku": "SKU5", "name": "Bad Price Item", "reorderPoint": -500, "stockByWarehouse": {} }`
10. **Bypassing Signature Checks on Purchase Orders**
   - Payload: `{ "id": "po_123", "poNumber": "PO-123", "status": "Issued", "warehouseId": "wh1", "items": [], "total": 0, "statusHistory": [{ "status": "Draft", "user": "Anonymous Spoof" }] }`
11. **Injecting Large Array Collections for denial-of-wallet operations**
   - Payload: `{ "id": "lots_9", "itemId": "item1", "lotNumber": "LOT9", "warehouseId": "wh1", "quantityReceived": 10, "quantityRemaining": 10, "dateReceived": "2026-05-20", "tags": [ ...1000 items... ] }`
12. **Modifying an Immutable Pinned Field**
   - Payload: `{ "id": "po_12", "poNumber": "PO-UPDATED-VAL" }` where `poNumber` is strict immutable.

## 3. Test Setup Outline (Test Runner Draft)
The mock assertions verify that `rules_version = '2'` safely handles all operations under the `PERMISSION_DENIED` status whenever negative test payloads are submitted through the SDK.
