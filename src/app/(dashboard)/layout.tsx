import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { getSessionContext } from "@/lib/queries/context";
import { logout } from "@/app/(auth)/actions";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace } = await getSessionContext();

  if (!user) redirect("/login");
  if (!workspace) redirect("/onboarding");

  const userName =
    (user.user_metadata?.full_name as string) ?? user.email ?? "Você";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        workspaceName={workspace.name}
        userName={userName}
        plan={workspace.plan}
        logoutAction={logout}
      />
      <main className="flex flex-1 flex-col overflow-y-auto">{children}</main>
    </div>
  );
}
