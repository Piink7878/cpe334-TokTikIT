# Lab 2 REST API Specification: TokTickIT Requester MVP

## 1. Overview & Conventions

This document defines the REST API contract for the TokTickIT Requester MVP. All endpoints return JSON payloads (except file download endpoints).

### 1.1 Base URL & Content Negotiation
- **Base URL**: `/api`
- **Request Content-Type**: `application/json` (or `multipart/form-data` for file uploads)
- **Response Content-Type**: `application/json; charset=utf-8` (or original binary MIME type for file downloads)

### 1.2 Development Requester Context Header
In Lab 2, simulated authentication context is passed via an HTTP header:
- `X-Requester-Id`: Integer ID of the active Development Requester (e.g., `X-Requester-Id: 1`).
- If missing or invalid on endpoints requiring requester ownership, the server responds with `400 Bad Request` or `403 Forbidden`.

### 1.3 Standard Error Response Format
All error responses return a standardized JSON structure:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable error description.",
    "details": [
      {
        "field": "summary",
        "message": "Summary must be between 5 and 150 characters."
      }
    ]
  }
}
```

---

## 2. Reference & Context Endpoints

### 2.1 Get Active Development Requesters
Retrieves the list of active requesters available for simulated testing selection. Inactive requesters (`isActive: false`) are strictly omitted.

- **Method / Endpoint**: `GET /api/requesters`
- **Request Headers**: None required.
- **Query Parameters**: None.
- **Request Body**: None.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": [
        {
          "id": 1,
          "name": "Jennifer Anderson",
          "email": "jennifer.anderson@example.com",
          "department": "Engineering"
        },
        {
          "id": 2,
          "name": "David Lee",
          "email": "david.lee@example.com",
          "department": "Marketing"
        },
        {
          "id": 3,
          "name": "Sarah Johnson",
          "email": "sarah.johnson@example.com",
          "department": "Human Resources"
        },
        {
          "id": 4,
          "name": "Michael Brown",
          "email": "michael.brown@example.com",
          "department": "Finance"
        }
      ]
    }
    ```
  - **500 Internal Server Error**: Database connection error.

---

### 2.2 Get Active Categories
Retrieves all reference ticket categories.

- **Method / Endpoint**: `GET /api/categories`
- **Request Headers**: None.
- **Query Parameters**: None.
- **Request Body**: None.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": [
        { "id": 1, "name": "Account and Access" },
        { "id": 2, "name": "Hardware" },
        { "id": 3, "name": "Software" },
        { "id": 4, "name": "Network" }
      ]
    }
    ```
  - **500 Internal Server Error**: Database failure.

---

### 2.3 Get Active Related Systems
Retrieves all active enterprise IT systems affected by tickets.

- **Method / Endpoint**: `GET /api/related-systems`
- **Request Headers**: None.
- **Query Parameters**: None.
- **Request Body**: None.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": [
        { "id": 1, "name": "Email" },
        { "id": 2, "name": "Campus Wi-Fi" },
        { "id": 3, "name": "VPN" },
        { "id": 4, "name": "LEB2 App" },
        { "id": 5, "name": "Grade Submission App" },
        { "id": 6, "name": "Printer" },
        { "id": 7, "name": "Corporate Laptop" }
      ]
    }
    ```
  - **500 Internal Server Error**: Database failure.

---

## 3. Ticket Endpoints

### 3.1 Create Ticket
Creates a new support ticket initialized with Current Status `New`. Generates the official unique `ticketNumber` on the backend.

- **Method / Endpoint**: `POST /api/tickets`
- **Request Headers**:
  - `Content-Type: application/json`
  - `X-Requester-Id: 1` (or requester ID supplied in body)
- **Request Body**:
  ```json
  {
    "requesterId": 1,
    "categoryId": 2,
    "relatedSystemId": 7,
    "summary": "Laptop battery drains quickly",
    "description": "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week's Windows update.",
    "requestedPriority": "MEDIUM"
  }
  ```
- **Validation Rules**:
  - `requesterId`: Required integer matching an active RequesterUser. Must strictly match the `X-Requester-Id` header; if they mismatch, the system returns `400 Bad Request` to prevent ambiguity.
  - `categoryId`: Required integer matching an active Category.
  - `relatedSystemId`: Required integer matching an active RelatedSystem.
  - `summary`: Required string, 5–150 characters after trimming.
  - `description`: Required string, 10–3000 characters after trimming.
  - `requestedPriority`: Required enum: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
- **Responses**:
  - **201 Created**:
    ```json
    {
      "data": {
        "id": 101,
        "ticketNumber": "TKT-2026-000101",
        "requesterId": 1,
        "categoryId": 2,
        "relatedSystemId": 7,
        "summary": "Laptop battery drains quickly",
        "description": "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week's Windows update.",
        "requestedPriority": "MEDIUM",
        "itPriority": "MEDIUM",
        "status": "NEW",
        "createdAt": "2026-09-02T10:15:30.000Z",
        "updatedAt": "2026-09-02T10:15:30.000Z"
      }
    }
    ```
  - **400 Bad Request**: Invalid inputs or missing required fields.
    ```json
    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed",
        "details": [
          { "field": "summary", "message": "Summary must be at least 5 characters long." }
        ]
      }
    }
    ```
  - **404 Not Found**: Specified Category or Related System does not exist.
  - **500 Internal Server Error**: Database write failure.

---

### 3.2 List Requester Tickets (My Tickets)
Retrieves a paginated list of tickets owned exclusively by the active requester.

- **Method / Endpoint**: `GET /api/tickets`
- **Request Headers**:
  - `X-Requester-Id: 1` (Required)
- **Query Parameters**:
  - `search` (optional string): Keyword match against `ticketNumber` and `summary`.
  - `categoryId` (optional integer): Filter by category ID.
  - `requestedPriority` (optional enum): Filter by `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`.
  - `itPriority` (optional enum): Filter by IT priority.
  - `status` (optional enum): Filter by `NEW`, `OPEN`, `IN_PROGRESS`, `PENDING`, `RESOLVED`, `CLOSED`.
  - `sortBy` (optional string): Sort field (`ticketNumber`, `createdAt`, `updatedAt`, `summary`). Default: `createdAt`.
  - `sortOrder` (optional string): Sort direction (`asc`, `desc`). Default: `desc`.
  - `page` (optional integer): Current page index (1-based). Default: `1`.
  - `pageSize` (optional integer): Items per page (e.g. 5, 8, 10, 20). Default: `8`.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": [
        {
          "id": 101,
          "ticketNumber": "TKT-2026-000101",
          "summary": "Laptop battery drains quickly",
          "category": { "id": 2, "name": "Hardware" },
          "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
          "requestedPriority": "MEDIUM",
          "itPriority": "MEDIUM",
          "status": "NEW",
          "createdAt": "2026-09-02T10:15:30.000Z",
          "updatedAt": "2026-09-02T10:15:30.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "pageSize": 8,
        "totalItems": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPreviousPage": false
      }
    }
    ```
  - **400 Bad Request**: Missing or malformed `X-Requester-Id`, or invalid pagination/filter parameters.
  - **500 Internal Server Error**: Database query error.

---

### 3.3 Get Ticket Details
Retrieves complete ticket metadata and attachment details. Enforces ownership check.

- **Method / Endpoint**: `GET /api/tickets/:id`
- **Request Headers**:
  - `X-Requester-Id: 1` (Required)
- **URL Parameters**:
  - `id`: Integer ticket primary key.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": {
        "id": 101,
        "ticketNumber": "TKT-2026-000101",
        "requester": {
          "id": 1,
          "name": "Jennifer Anderson",
          "email": "jennifer.anderson@example.com",
          "department": "Engineering"
        },
        "category": { "id": 2, "name": "Hardware" },
        "relatedSystem": { "id": 7, "name": "Corporate Laptop" },
        "summary": "Laptop battery drains quickly",
        "description": "My laptop battery is draining much faster than usual even when the system is idle. This started happening after last week's Windows update.",
        "requestedPriority": "MEDIUM",
        "itPriority": "MEDIUM",
        "status": "NEW",
        "createdAt": "2026-09-02T10:15:30.000Z",
        "updatedAt": "2026-09-02T10:15:30.000Z",
        "attachments": [
          {
            "id": 501,
            "originalFilename": "battery_report.pdf",
            "fileSize": 1048576,
            "contentType": "application/pdf",
            "isRemoved": false,
            "removedAt": null,
            "removedReason": null,
            "createdAt": "2026-09-02T10:16:00.000Z"
          },
          {
            "id": 502,
            "originalFilename": "screenshot_error.png",
            "fileSize": 450200,
            "contentType": "image/png",
            "isRemoved": true,
            "removedAt": "2026-09-02T11:00:00.000Z",
            "removedReason": "Uploaded duplicate outdated screenshot",
            "createdAt": "2026-09-02T10:16:00.000Z"
          }
        ]
      }
    }
    ```
  - **403 Forbidden**: Ticket exists but belongs to another requester (`ticket.requesterId !== X-Requester-Id`).
    ```json
    {
      "error": {
        "code": "FORBIDDEN_ACCESS",
        "message": "You do not have permission to view this ticket."
      }
    }
    ```
  - **404 Not Found**: Ticket with given ID does not exist.
  - **500 Internal Server Error**: Database retrieval error.

---

## 4. Attachment Endpoints

### 4.1 Upload Attachment to Ticket
Uploads a new attachment for an existing owned ticket. Enforces maximum 5 active attachments limit, file format constraints (JPG, PNG, WEBP, PDF), and maximum 5 MB file size.

- **Method / Endpoint**: `POST /api/tickets/:id/attachments`
- **Request Headers**:
  - `Content-Type: multipart/form-data`
  - `X-Requester-Id: 1` (Required)
- **URL Parameters**:
  - `id`: Integer ticket ID.
- **Request Body (Multipart Form Data)**:
  - `file`: Binary file stream (max 5,242,880 bytes).
- **Validation Rules**:
  - MIME type must be one of: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`.
  - File size must be $\le 5	ext{ MB}$.
  - Current active attachments count on ticket must be $< 5$.
  - Ticket must be owned by `X-Requester-Id`.
- **Responses**:
  - **201 Created**:
    ```json
    {
      "data": {
        "id": 503,
        "ticketId": 101,
        "originalFilename": "power_diagnostics.pdf",
        "fileSize": 2097152,
        "contentType": "application/pdf",
        "isRemoved": false,
        "createdAt": "2026-09-02T11:30:00.000Z"
      }
    }
    ```
  - **400 Bad Request**: Invalid file extension, corrupted file, or exceeding 5 active attachments limit.
    ```json
    {
      "error": {
        "code": "ATTACHMENT_LIMIT_EXCEEDED",
        "message": "A ticket cannot have more than 5 active attachments."
      }
    }
    ```
  - **403 Forbidden**: Requester does not own the target ticket.
  - **404 Not Found**: Ticket does not exist.
  - **413 Payload Too Large**: File size exceeds 5 MB.
    ```json
    {
      "error": {
        "code": "FILE_TOO_LARGE",
        "message": "Attachment file size exceeds the 5MB limit."
      }
    }
    ```
  - **500 Internal Server Error**: Storage write error.

---

### 4.2 Download Active Attachment
Streams the binary content of an active attachment. Verifies ownership and blocks soft-removed files.

- **Method / Endpoint**: `GET /api/attachments/:id/download`
- **Request Headers**:
  - `X-Requester-Id: 1` (Required)
- **URL Parameters**:
  - `id`: Integer attachment ID.
- **Responses**:
  - **200 OK**:
    - `Content-Type`: Matching file MIME type (e.g. `application/pdf`, `image/png`).
    - `Content-Disposition`: `attachment; filename="battery_report.pdf"`
    - `Content-Length`: Exact file size in bytes.
    - Body: Binary stream.
  - **403 Forbidden**: Requester does not own the ticket associated with this attachment.
  - **404 Not Found**: Attachment ID not found.
  - **410 Gone**: Attachment has been soft-removed; file retrieval is permanently blocked.
    ```json
    {
      "error": {
        "code": "ATTACHMENT_REMOVED",
        "message": "This attachment was removed and can no longer be downloaded."
      }
    }
    ```
  - **500 Internal Server Error**: Disk read error.

---

### 4.3 Soft Remove Attachment
Marks an attachment as soft-removed. Requires a non-empty removal reason. Physical storage access is disabled while metadata is retained.

- **Method / Endpoint**: `DELETE /api/attachments/:id`
- **Request Headers**:
  - `Content-Type: application/json`
  - `X-Requester-Id: 1` (Required)
- **URL Parameters**:
  - `id`: Integer attachment ID.
- **Request Body**:
  ```json
  {
    "removalReason": "Uploaded outdated configuration file by mistake"
  }
  ```
- **Validation Rules**:
  - `removalReason`: Required non-empty string, minimum 5 characters, maximum 255 characters.
  - Attachment must currently be active (`isRemoved === false`).
  - Target ticket must belong to `X-Requester-Id`.
- **Responses**:
  - **200 OK**:
    ```json
    {
      "data": {
        "id": 501,
        "ticketId": 101,
        "originalFilename": "battery_report.pdf",
        "isRemoved": true,
        "removedAt": "2026-09-02T12:00:00.000Z",
        "removedReason": "Uploaded outdated configuration file by mistake",
        "removedByRequesterId": 1
      }
    }
    ```
  - **400 Bad Request**: Missing or empty `removalReason`, or attachment is already removed.
    ```json
    {
      "error": {
        "code": "MISSING_REMOVAL_REASON",
        "message": "A non-empty removal reason is required to remove an attachment."
      }
    }
    ```
  - **403 Forbidden**: Requester does not own the ticket containing this attachment.
  - **404 Not Found**: Attachment ID not found.
  - **500 Internal Server Error**: Database update error.

---

## 5. Summary of HTTP Status Codes

| Status Code | Description & Usage in Lab 2 |
| :--- | :--- |
| **200 OK** | Successful retrieval, file streaming, or soft deletion completion. |
| **201 Created** | Ticket successfully created with generated Ticket Number, or attachment uploaded. |
| **400 Bad Request** | Input validation failed, missing `X-Requester-Id`, or exceeding 5-attachment limit. |
| **403 Forbidden** | Ownership mismatch (attempting to view/download/delete another user's ticket/attachment). |
| **404 Not Found** | Resource (ticket, category, system, attachment) not found. |
| **410 Gone** | Attempting to preview or download an attachment that has been soft-removed. |
| **413 Payload Too Large** | Uploaded file size exceeds the 5 MB ceiling. |
| **500 Internal Server Error** | Unexpected server crash, database transaction failure, or filesystem I/O error. |
