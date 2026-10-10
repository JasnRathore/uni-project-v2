# Database service facade

**Source:** `database/services/dbService.js`  
**Evidence:** Exports, initialization, SQL, and error-return conventions verified in source. It is the shared dependency of API persistence modules and middleware.

## Exports and client lifecycle

Exports `getDatabaseClient`, `ensureDatabaseReady`, `getAuthService`, `authUserFromRow`, `unpackMetadata`, and pass-through `readPortalData`, `writePortalData`, `deletePortalData`, `listPortalDataByPrefix`, and `withTransaction`.

At module load it asks dotenv to load root `.env`. The client is created lazily once. Target `local` uses `LOCAL_DATABASE_URL || 'file:local.db'`; `turso` requires both Turso URL and token; with no target and no Turso URL it uses local; with a Turso URL but no explicit recognized target it throws. `ensureDatabaseReady` memoizes schema initialization; rejected initialization clears the memo so a later call retries, and wraps the failure with a schema-initialization prefix. `getDatabaseClient` itself does not ensure the schema.

## Auth compatibility facade

`unpackMetadata` parses string JSON (empty/falsy defaults to `{}`), throws on malformed JSON, accepts canonical `{user_metadata, app_metadata}` wrappers, and treats other objects as legacy user metadata with empty app metadata. `authUserFromRow` maps DB columns to an auth-shaped user.

`getAuthService()` returns `{auth:{admin}}` around one DB client:

- `listUsers({page=1, perPage=1000})` queries ordered users with limit/offset and returns `{data:{users}, error:null}`. It adds unpacked metadata while retaining selected row fields.
- `deleteUser(id)` transactionally deletes a linked student row only when DB role is exactly student, then deletes the user. Returns `{error:null}` or `{error}`; other FK effects follow schema.
- `createUser({email,password,user_metadata={}})` requires both, generates UUID, bcrypt-hashes at cost 10, derives role (student default), removes `department` for teachers, stores wrapped metadata, and transactionally creates relational student/profile data. Teachers get `teacher_profiles`. Returns `{data:{user},error:null}` or `{data:null,error}`.
- `updateUserById` transactionally reads user, merges provided metadata objects, computes role/name, updates canonical user fields, then ensures student state or upserts teacher profile. Returns `{error:null}` or `{error}`.
- `getUserById` reads one user and returns auth-shaped `{data:{user},error:null}` or `{data:null,error: Error('Not found')}`. DB exceptions are not caught here.

## Transactions, dependencies, and caveats

Uses `@libsql/client`, `bcryptjs`, `uuid`, `dotenv`, `schemaService`, and lazily requires `relationalDataService` to avoid circular module initialization. Student/profile creation/deletion and user changes are transactionally coupled. In contrast, read/list methods are not transactional. Updating a user from one role to another does not explicitly remove the old role's side-table data. SQL constraints and deletion effects are in `new_schema.sql`.

**Verified:** branches, method return forms, and transactional boundaries. **Unknown:** exact remote-client connection lifetime and behavior when callers use the service without first awaiting `ensureDatabaseReady`.
