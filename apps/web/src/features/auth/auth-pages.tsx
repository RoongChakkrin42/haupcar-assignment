import { registerSchema } from '@haupcar/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { type ReactNode, useId } from 'react';
import { type FieldPath, type FieldValues, type UseFormReturn, useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { z } from 'zod';
import { Brand } from '@/components/brand';
import { LicensePlate } from '@/components/license-plate';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { errorMessage } from '@/lib/api';
import { homeFor, useAuth } from './auth-context';

const loginForm = z.object({
  email: z.email('กรอกอีเมลให้ถูกต้อง'),
  password: z.string().min(1, 'กรอกรหัสผ่าน'),
});
type RegisterForm = z.input<typeof registerSchema>;

function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(26rem,32rem)]">
      <div className="hidden flex-col justify-between bg-plate-ink p-10 text-white lg:flex">
        <div>
          <Brand />
        </div>
        <div className="flex flex-col gap-6">
          <LicensePlate number="1กข1234" province="กรุงเทพมหานคร" size="lg" />
          <p className="max-w-md font-heading text-3xl leading-snug font-semibold">
            รถจอดอยู่เฉยๆ ให้คนแถวบ้านเช่ารายวัน ลงทะเบียนครั้งเดียว ทีมงานตรวจให้ก่อนเปิดเช่า
          </p>
        </div>
        <p className="text-sm text-white/60">Haupcar demo</p>
      </div>
      <main className="flex flex-col justify-center gap-8 px-6 py-12 sm:px-12">
        <div className="lg:hidden">
          <Brand />
        </div>
        <h1 className="text-3xl font-semibold">{title}</h1>
        {children}
        <p className="text-sm text-muted-foreground">{footer}</p>
      </main>
    </div>
  );
}

function TextField<T extends FieldValues>({
  form,
  name,
  label,
  ...input
}: { form: UseFormReturn<T>; name: FieldPath<T>; label: string } & Omit<
  React.ComponentProps<'input'>,
  'form' | 'name'
>) {
  const id = useId();
  const error = form.formState.errors[name] as { message?: string } | undefined;
  return (
    <Field data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} aria-invalid={!!error} {...input} {...form.register(name)} />
      <FieldError errors={[error]} />
    </Field>
  );
}

function RootError({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm({
    resolver: zodResolver(loginForm),
    defaultValues: { email: '', password: '' },
  });

  if (user) return <Navigate to={params.get('next') ?? homeFor(user)} replace />;

  const submit = form.handleSubmit(async ({ email, password }) => {
    try {
      const u = await login(email, password);
      navigate(params.get('next') ?? homeFor(u), { replace: true });
    } catch (e) {
      form.setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <AuthShell
      title="เข้าสู่ระบบ"
      footer={
        <>
          ยังไม่มีบัญชี?{' '}
          <Link to="/register" className="font-medium text-primary hover:underline">
            สมัครเพื่อลงรถ
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField form={form} name="email" label="อีเมล" type="email" autoComplete="email" />
        <TextField
          form={form}
          name="password"
          label="รหัสผ่าน"
          type="password"
          autoComplete="current-password"
        />
        <RootError message={form.formState.errors.root?.message} />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
        </Button>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', phone: '', password: '' },
  });

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = form.handleSubmit(async (values) => {
    try {
      await register({ ...values, phone: values.phone || undefined } as never);
      navigate('/vehicles/new', { replace: true });
    } catch (e) {
      form.setError('root', { message: errorMessage(e) });
    }
  });

  return (
    <AuthShell
      title="สมัครเพื่อลงรถ"
      footer={
        <>
          มีบัญชีแล้ว?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            เข้าสู่ระบบ
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField form={form} name="name" label="ชื่อ" autoComplete="name" />
        <TextField form={form} name="email" label="อีเมล" type="email" autoComplete="email" />
        <TextField
          form={form}
          name="phone"
          label="เบอร์โทร (ไม่บังคับ)"
          type="tel"
          autoComplete="tel"
        />
        <TextField
          form={form}
          name="password"
          label="รหัสผ่าน (อย่างน้อย 8 ตัว)"
          type="password"
          autoComplete="new-password"
        />
        <RootError message={form.formState.errors.root?.message} />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? 'กำลังสมัคร…' : 'สมัครและเริ่มลงรถ'}
        </Button>
      </form>
    </AuthShell>
  );
}
