-- No negative money where it can't be. Entry, bill, split, goal and loan
-- amounts were already checked > 0; this adds the manual net worth totals.
-- A bank/cash/wallet account's *balance today* can't be typed below zero --
-- that's checked in the forms, not here: the stored opening_balance is derived
-- (balance today minus what's logged) and can legitimately be negative.

alter table public.user_settings
  add constraint user_settings_net_worth_not_negative
  check ((assets_total is null or assets_total >= 0) and (liabilities_total is null or liabilities_total >= 0));
