alter table "federationTransaction" add column "completedSessionId" text;

alter table "federationTransaction" add column "claims" integer default 0;
