-- Directory sync: users imported from an external directory (Authentik) are linked to it by the
-- directory's own id, and a department remembers whether its manager was chosen by the sync.
-- Never edit this file once applied. Add a new V<n>__description.sql instead.

-- users: where the account comes from. All three are NULL for local accounts (created in the app,
-- by registration or by the seeders); the sync never changes those.
ALTER TABLE users ADD COLUMN external_source character varying(32);
ALTER TABLE users ADD COLUMN external_id character varying(64);
ALTER TABLE users ADD COLUMN external_username character varying(255);

ALTER TABLE users ADD CONSTRAINT ck_users_external_link
    CHECK ((external_source IS NULL) = (external_id IS NULL));

-- One local account per directory account. NULLs never collide, so local accounts are unaffected.
CREATE UNIQUE INDEX ux_users_external ON users (external_source, external_id);

-- departments: 'authentik' when the sync made manager_id the head, NULL when a person chose it
-- (or there is none). The sync only replaces a manager it set itself.
ALTER TABLE departments ADD COLUMN manager_source character varying(32);
