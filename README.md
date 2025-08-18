## Not Just a Database — A Data Engine for Modern Systems

_Reimagining NoSQL with schema enforcement, columnar speed, and developer-first design_

📚 **Documentation**: [https://diana-db.com/odm/overview](https://diana-db.com/odm/overview)

---

At Diana DB, our mission is to equip developers with a powerful data design and management tool — one that's engineered to solve real-world problems. We care not only about outcomes, but also about experience. That means writing less code, spending less time reading documentation, and mastering new tools faster — all while enjoying the process.

Diana DB is a **NoSQL, column-oriented database**. Although it operates with documents (similar to objects or structs) and collections, it stores data in a highly optimized columnar format. Each document is decomposed into separate columns — each column tailored to a specific data type with its own dedicated logic for storage and processing.

Data integrity is enforced through document schemas that define the expected structure within each collection. This architecture allows every field in a document to function like an index, enabling exceptional query performance.

If you're already familiar with MongoDB or other popular NoSQL databases, onboarding with Diana DB will be easy — its query language is conceptually close to MongoDB’s MQL.

Diana DB supports relationships between documents across different collections — even triggers, much like traditional relational databases. For example, if you have `user` and `post` collections, you can retrieve all posts from a user named **John Doe** — no JOINs or lookups required. You can also fetch all posts by users belonging to a specific team, even if the post only stores the user ID and the user stores only the team ID.

---

### Key Capabilities

- **Cross-Database Lookups**  
  Join and merge data across multiple databases stored on the same server.

- **Temporal Queries**  
  Need to fetch all documents related to Tuesdays in July 2025? One query does it.  
  Need to shift all scheduled events to the next available day? Easy — one query.  
  All powered by the special `TIME` type and flexible time-based tools.

- **Geospatial Queries**  
  Need to find users within a polygon? Just pass coordinates.  
  Have a route and want to find who you can pick up along the way? It's just as simple.

- **Command-Based Updates**  
  Update documents using logical operations, not just scalar values.

- **ACID Transactions**  
  Perform safe, consistent, non-blocking operations on your data.

- **Built-In Migrations**  
  Define and manage schema evolution directly — no external tools required.

- **Subscriptions and Change Tracking**  
  Subscribe to changes in the whole DB or a specific collection.  
  Simplify your architecture, reduce load on APIs and message brokers.
