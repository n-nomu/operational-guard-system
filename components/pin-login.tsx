'use client';

import { useState, useEffect } from 'react';
import { Shield, Delete, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { getStaff, getSession, setSession } from '@/lib/storage';
import { ADMIN_PIN, type Session } from '@/lib/types';

interface PinLoginProps {
  onLogin: (session: Session) => void;
}

export function PinLogin({ onLogin }: PinLoginProps) {
  const [pin, setPin] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  useEffect(() => {
    // Check for existing session
    const session = getSession();
    if (session?.rememberMe) {
      onLogin(session);
    }
  }, [onLogin]);

  const handleKeyPress = (key: string) => {
    if (pin.length < 4) {
      const newPin = [...pin, key];
      setPin(newPin);
      setError('');

      if (newPin.length === 4) {
        validatePin(newPin.join(''));
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    setError('');
    setSuccess('');
  };

  const handleClear = () => {
    setPin([]);
    setError('');
    setSuccess('');
  };

  const validatePin = (enteredPin: string) => {
    // Normalize PIN to lowercase for comparison
    const normalizedPin = enteredPin.toLowerCase();

    // Check if admin PIN
    if (normalizedPin === ADMIN_PIN.toLowerCase()) {
      setSuccess('Admin access granted');
      const session: Session = {
        staffId: 'admin',
        staffName: 'Administrator',
        isAdmin: true,
        rememberMe,
        loginTime: new Date().toISOString(),
      };
      setSession(session);
      setTimeout(() => onLogin(session), 500);
      return;
    }

    // Check staff PINs (case-insensitive)
    const staff = getStaff();
    const staffMember = staff.find(s => s.pin.toLowerCase() === normalizedPin);

    if (staffMember) {
      setSuccess(`Welcome, ${staffMember.name}`);
      const session: Session = {
        staffId: staffMember.id,
        staffName: staffMember.name,
        isAdmin: false,
        rememberMe,
        loginTime: new Date().toISOString(),
      };
      setSession(session);
      setTimeout(() => onLogin(session), 500);
    } else {
      setError('Invalid PIN');
      setTimeout(() => {
        setPin([]);
        setError('');
      }, 1500);
    }
  };

  const keypadNumbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm bg-card border-border">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl font-semibold text-card-foreground">
            THE SURVIVAL MANAGER
          </CardTitle>
          <p className="text-sm text-muted-foreground">Enter your 4-digit PIN</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* PIN Dots */}
          <div className="flex justify-center gap-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  pin[i]
                    ? error
                      ? 'bg-destructive'
                      : success
                        ? 'bg-success'
                        : 'bg-primary'
                    : 'bg-muted border-2 border-border'
                }`}
              />
            ))}
          </div>

          {/* Status Messages */}
          {error && (
            <div className="flex items-center justify-center gap-2 text-destructive text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center justify-center gap-2 text-success text-sm">
              <CheckCircle className="w-4 h-4" />
              {success}
            </div>
          )}

          {/* Numeric Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {keypadNumbers.map((key) => (
              <Button
                key={key}
                variant={key === 'C' || key === '⌫' ? 'secondary' : 'outline'}
                className={`h-14 text-xl font-medium ${
                  key === 'C' || key === '⌫' ? 'text-muted-foreground' : 'text-foreground'
                }`}
                onClick={() => {
                  if (key === 'C') handleClear();
                  else if (key === '⌫') handleDelete();
                  else handleKeyPress(key);
                }}
                disabled={!!success}
              >
                {key === '⌫' ? <Delete className="w-5 h-5" /> : key}
              </Button>
            ))}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-center gap-2">
            <Checkbox
              id="remember"
              checked={rememberMe}
              onCheckedChange={(checked) => setRememberMe(checked === true)}
            />
            <label
              htmlFor="remember"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Remember me on this device
            </label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
