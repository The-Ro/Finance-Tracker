-- Run this once in the Supabase SQL editor, together with the app deploy that
-- ships the matching buildFingerprint() change (src/lib/fingerprint.ts).
-- Safe to re-run: rows already carrying the suffix are skipped.
--
-- The duplicate fingerprint used to ignore the transaction type, so a
-- same-day refund (income) with the same merchant/amount/account as the
-- purchase got the identical key and CSV import silently dropped it as a
-- "duplicate". Expense fingerprints are unchanged; income gets '|income' and
-- transfers get '|transfer|<to account>' appended. Rows saved with "Save
-- anyway" keep their '|dup-...' suffix in front of the new one, still unique.

update public.transactions
set fingerprint = fingerprint || '|income'
where type = 'income'
  and fingerprint is not null
  and fingerprint not like '%|income';

update public.transactions
set fingerprint = fingerprint || '|transfer|' || lower(trim(coalesce(to_account, '')))
where type = 'transfer'
  and fingerprint is not null
  and fingerprint not like '%|transfer|%';
