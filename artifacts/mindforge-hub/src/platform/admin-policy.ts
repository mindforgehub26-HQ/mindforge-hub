// Eligibility only: Firebase claims and the server-owned role are also required.
export function isAllowedAdmin(email: string | null | undefined) {
  return ["mindforgehub26@gmail.com", "dayanandmk.dev@gmail.com"].includes(email || "");
}
