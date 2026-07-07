export function createContextValue<Session>(session: Session, videosBucket: R2Bucket) {
  return {
    auth: null,
    videosBucket,
    session,
  };
}
