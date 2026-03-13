import { ResetPasswordForm } from "@/components/reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6 lg:px-8">
      <ResetPasswordForm initialToken={params?.token || ""} />
    </div>
  );
}
