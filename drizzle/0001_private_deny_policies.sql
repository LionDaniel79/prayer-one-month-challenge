create policy deny_non_backend_access on prayer_app.challenges
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.sams
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.users
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.prayer_checkins
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.sessions
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.auth_rate_limits
  as restrictive for all to public using (false) with check (false);
