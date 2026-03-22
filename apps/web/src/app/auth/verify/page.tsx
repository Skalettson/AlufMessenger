'use client';

import { Suspense, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { getErrorMessage } from '@/lib/api';
import { MessageCircle, Terminal, Shield, Mail } from 'lucide-react';

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('id') || '';
  const { verify, login, devCode, verificationId, requires2fa, twoFactorVerified, setTwoFactorVerified } = useAuthStore();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [twoFactorCode, setTwoFactorCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const twoFactorInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [step, setStep] = useState<'otp' | '2fa'>('otp');

  useEffect(() => {
    if (!email || !verificationId) {
      router.replace('/auth');
      return;
    }
    inputRefs.current[0]?.focus();
  }, [email, verificationId, router]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (step === '2fa') {
      twoFactorInputRefs.current[0]?.focus();
    }
  }, [step]);

  const handleChange = useCallback((index: number, value: string, is2fa = false) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const setter = is2fa ? setTwoFactorCode : setCode;
    const refs = is2fa ? twoFactorInputRefs : inputRefs;
    setter((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent, is2fa = false) => {
    if (e.key === 'Backspace' && !(is2fa ? twoFactorCode[index] : code[index]) && index > 0) {
      const refs = is2fa ? twoFactorInputRefs : inputRefs;
      refs.current[index - 1]?.focus();
    }
  }, [code, twoFactorCode]);

  const handlePaste = useCallback((e: React.ClipboardEvent, is2fa = false) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;
    const setter = is2fa ? setTwoFactorCode : setCode;
    setter(pasted.padEnd(6, '').split('').slice(0, 6));
    const refs = is2fa ? twoFactorInputRefs : inputRefs;
    refs.current[Math.min(pasted.length, 5)]?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = code.join('');
    const twoFactor = twoFactorCode.join('');
    
    if (otp.length !== 6) return;
    if (requires2fa && !twoFactorVerified && twoFactor.length !== 6) return;
    
    setError('');
    setLoading(true);
    try {
      if (requires2fa && !twoFactorVerified) {
        await verify(otp, twoFactor);
      } else {
        await verify(otp);
      }
      router.refresh();
      const pendingRedirect = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aluf_redirect_after_auth') : null;
      if (pendingRedirect) {
        sessionStorage.removeItem('aluf_redirect_after_auth');
        router.replace(pendingRedirect);
      } else {
        router.replace('/chat');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Неверный код');
      if (requires2fa && !twoFactorVerified) {
        setTwoFactorCode(['', '', '', '', '', '']);
        twoFactorInputRefs.current[0]?.focus();
      } else {
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    try {
      await login(email);
      setResendCooldown(60);
    } catch {}
  }

  /** На шаге OTP не вызываем verify без TOTP — иначе раньше сгорал одноразовый код из письма. */
  async function handleOtpSubmit() {
    const otp = code.join('');
    if (otp.length !== 6) return;
    setError('');

    if (requires2fa && !twoFactorVerified) {
      setStep('2fa');
      return;
    }

    setLoading(true);
    try {
      await verify(otp);
      router.refresh();
      const pendingRedirect = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('aluf_redirect_after_auth') : null;
      if (pendingRedirect) {
        sessionStorage.removeItem('aluf_redirect_after_auth');
        router.replace(pendingRedirect);
      } else {
        router.replace('/chat');
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Неверный код');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-y-contain items-center justify-center bg-background px-4 py-8 safe-area-top safe-area-bottom">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <MessageCircle className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">
            {step === 'otp' ? 'Введите код' : '2FA верификация'}
          </h1>
          <p className="text-muted-foreground text-sm text-center">
            {step === 'otp' ? (
              <>Код отправлен на <span className="font-medium text-foreground">{email}</span></>
            ) : (
              <>Введите код из приложения аутентификатора</>
            )}
          </p>
        </div>

        {devCode && step === 'otp' && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <Terminal className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
            <div>
              <p className="text-sm font-medium text-amber-500">Dev Mode</p>
              <p className="mt-1 font-mono text-2xl font-bold tracking-[0.3em] text-foreground">
                {devCode}
              </p>
            </div>
          </div>
        )}

        {requires2fa && !twoFactorVerified && step === 'otp' && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-4">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-medium text-primary">Требуется 2FA</p>
              <p className="text-xs text-muted-foreground mt-1">
                После ввода кода из SMS/email потребуется ввести код из приложения аутентификатора
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center gap-2" onPaste={(e) => handlePaste(e, step === '2fa')}>
            {(step === 'otp' ? code : twoFactorCode).map((digit, i) => (
              <input
                key={i}
                ref={(el) => { (step === 'otp' ? inputRefs : twoFactorInputRefs).current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value, step === '2fa')}
                onKeyDown={(e) => handleKeyDown(i, e, step === '2fa')}
                className="h-14 w-12 rounded-lg border border-input bg-background text-center text-2xl font-semibold focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ))}
          </div>

          {error && <p className="text-sm text-destructive text-center">{error}</p>}

          {step === 'otp' ? (
            <>
              <Button type="button" onClick={handleOtpSubmit} className="w-full" disabled={loading || code.join('').length !== 6}>
                {loading ? 'Проверка...' : requires2fa && !twoFactorVerified ? 'Далее' : 'Подтвердить'}
              </Button>
            </>
          ) : (
            <>
              <Button type="submit" className="w-full" disabled={loading || twoFactorCode.join('').length !== 6}>
                {loading ? 'Проверка...' : 'Войти'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep('otp');
                  setTwoFactorCode(['', '', '', '', '', '']);
                  inputRefs.current[0]?.focus();
                }}
              >
                Назад
              </Button>
            </>
          )}

          {step === 'otp' && (
            <p className="text-center text-sm text-muted-foreground">
              {resendCooldown > 0 ? (
                <>Отправить повторно через {resendCooldown} сек.</>
              ) : (
                <button type="button" onClick={handleResend} className="text-primary hover:underline">
                  Отправить код повторно
                </button>
              )}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="h-10 w-10 rounded-full bg-primary animate-pulse" />
      </div>
    }>
      <VerifyForm />
    </Suspense>
  );
}
