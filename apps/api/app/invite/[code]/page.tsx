import type { Metadata } from "next";
import InviteLanding from "./InviteLanding";

export const metadata: Metadata = {
  title: "Convite para o FungoCord",
  description: "Abra este convite no FungoCord e entre no servidor.",
};

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <InviteLanding code={code} />;
}
