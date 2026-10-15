import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RegistrationForm from "@/components/RegistrationForm";
import { TEAM_TYPES, getTeamType } from "@/lib/registration";

type Props = { params: Promise<{ type: string }> };

export function generateStaticParams() {
  return TEAM_TYPES.map((t) => ({ type: t.id }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const team = getTeamType((await params).type);
  return { title: team ? `Register (${team.label})` : "Register" };
}

export default async function TeamRegisterPage({ params }: Props) {
  const team = getTeamType((await params).type);
  if (!team) notFound();

  return (
    <main className="form-page">
      <div className="container">
        <RegistrationForm teamType={team.id} />
      </div>
    </main>
  );
}
