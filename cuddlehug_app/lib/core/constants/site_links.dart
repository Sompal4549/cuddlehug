/// Production site URLs used for legal links and external navigation.
///
/// The web app serves these at `/terms` and `/privacy` (the `[doc]` route).
/// `siteBaseUrl` is an external decision — confirm before release
/// (tracked in the handoff blocker list).
abstract final class SiteLinks {
  static const siteBaseUrl = 'https://www.cuddlehug.in';

  static const terms = '$siteBaseUrl/terms';
  static const privacy = '$siteBaseUrl/privacy';
}
