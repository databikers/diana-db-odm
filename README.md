# @diana-db/odm

Official Object Document Mapper (ODM) for [Diana DB](https://diana-db.com) – a fast, ACID-compliant No-SQL database.

**Diana DB**is a **column-oriented**, **schema-controlled**NoSQL database built entirely in **TypeScript**and compiled to JavaScript. It runs as a standalone **Node.js application**or as a **Docker container**via our official image.

## What makes Diana DB unique?

### Column-Oriented Storage
Each inserted document is decomposed into primitive values and stored in specialized data structures — one per field. In practice, this means every property acts like an index, enabling **fast insertion, updates, and lookups**.

### Schema Enforcement
Diana DB is schema-controlled, enforcing strict data rules at the structural level to ensure **integrity**and **consistency**across your data.

---

## Key Features

- **Security** 
  All client-server communication is encrypted with **no key exchange**during connection. Without the correct credentials, data access or tampering is impossible.

- **High Performance** 
  Diana DB is optimized for **speed and scalability**, built for high-throughput workloads.

- **Resilience** 
  It automatically persists data and restores it on server restart, ensuring **robust recovery**.

- **Special Column Types**
  - `TIME`: query across dates (e.g. all Mondays in April and June 2020)
  - `POSITION`: spatial queries (e.g. within a polygon or radius)

- **Built-in Migrations** 
  Native support for **migrations**— no external tools required.

- **Non-blocking Transactions** 
  Reliable, consistent operations with **non-blocking transaction support**.

- **Multi-field Sorting** 
  Order your query results by multiple fields with ease.

- **Transform Queries** 
  Apply powerful transformations to documents — similar in spirit to **MongoDB aggregations**.

---

## Roadmap & Feedback

We are continuously evolving Diana DB and actively expanding its capabilities as it moves through **beta**.  
Your **feedback and ideas**are always welcome — help us shape the future of Diana DB.

Visit the official ODM documentation: [https://diana-db.com/odm](https://diana-db.com/odm)

---

MIT © [Data Bikers Limited](https://databikers.com)
