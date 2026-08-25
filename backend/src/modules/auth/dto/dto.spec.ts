import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateAdminDto } from './create-admin.dto';
import { UpdateProfileDto } from './update-profile.dto';
import { UpdatePasswordDto } from './update-password.dto';
import { LoginDto } from './login.dto';
import { ConfirmPasswordDto } from './confirm-password.dto';

const errorsFor = <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) =>
  validateSync(plainToInstance(cls, payload)).flatMap((error) =>
    Object.values(error.constraints ?? {}),
  );

const propertiesFor = <T extends object>(
  cls: new () => T,
  payload: Record<string, unknown>,
) => validateSync(plainToInstance(cls, payload)).map((e) => e.property);

const strongPassword = 'Hunter2Hunter2!';

describe('CreateAdminDto', () => {
  const valid = {
    username: 'testuser',
    email: 'v@example.com',
    password: strongPassword,
    confirmPassword: strongPassword,
  };

  it('accepts a well formed payload', () => {
    expect(errorsFor(CreateAdminDto, valid)).toEqual([]);
  });

  it('requires a username of at least three characters', () => {
    expect(
      propertiesFor(CreateAdminDto, { ...valid, username: 'ab' }),
    ).toContain('username');
  });

  it('accepts a payload with no email at all', () => {
    const { email: _email, ...withoutEmail } = valid;
    expect(errorsFor(CreateAdminDto, withoutEmail)).toEqual([]);
  });

  it.each([undefined, null, ''])('skips email validation for %p', (email) => {
    expect(propertiesFor(CreateAdminDto, { ...valid, email })).not.toContain(
      'email',
    );
  });

  it('rejects a malformed email when one is supplied', () => {
    expect(
      propertiesFor(CreateAdminDto, { ...valid, email: 'nope' }),
    ).toContain('email');
  });
});

describe('StrongPassword', () => {
  const passwordErrors = (password: unknown) =>
    errorsFor(CreateAdminDto, {
      username: 'testuser',
      password,
      confirmPassword: 'x',
    });

  it('accepts a password with every character class', () => {
    expect(passwordErrors(strongPassword)).toEqual([]);
  });

  it.each([
    ['too short', 'Hunter2!'],
    ['no lowercase', 'HUNTER2HUNTER2!'],
    ['no uppercase', 'hunter2hunter2!'],
    ['no digit', 'HunterHunterHu!'],
    ['no symbol', 'Hunter2Hunter22'],
  ])('rejects a password with %s', (_reason, password) => {
    expect(passwordErrors(password).length).toBeGreaterThan(0);
  });

  it('explains what a password needs', () => {
    expect(passwordErrors('short').join(' ')).toContain(
      'uppercase, lowercase, number, and special character',
    );
  });

  it('rejects a password longer than 128 characters', () => {
    expect(passwordErrors(`Aa1!${'x'.repeat(130)}`).length).toBeGreaterThan(0);
  });

  it('rejects a non-string password', () => {
    expect(passwordErrors(12345678901234).length).toBeGreaterThan(0);
  });

  it('applies the same rule to a password change', () => {
    expect(
      propertiesFor(UpdatePasswordDto, {
        currentPassword: 'old',
        newPassword: 'weak',
        confirmPassword: 'weak',
      }),
    ).toContain('newPassword');
  });
});

describe('UpdateProfileDto', () => {
  it('accepts an empty payload', () => {
    expect(errorsFor(UpdateProfileDto, {})).toEqual([]);
  });

  it.each([undefined, null, ''])('skips email validation for %p', (email) => {
    expect(propertiesFor(UpdateProfileDto, { email })).not.toContain('email');
  });

  it('rejects a malformed email when one is supplied', () => {
    expect(propertiesFor(UpdateProfileDto, { email: 'nope' })).toContain(
      'email',
    );
  });

  it('requires a username of at least three characters', () => {
    expect(propertiesFor(UpdateProfileDto, { username: 'ab' })).toContain(
      'username',
    );
  });

  it('accepts an avatar url as free text', () => {
    expect(errorsFor(UpdateProfileDto, { avatarUrl: 'anything' })).toEqual([]);
  });
});

describe('UpdatePasswordDto', () => {
  const valid = {
    currentPassword: 'old',
    newPassword: strongPassword,
    confirmPassword: strongPassword,
  };

  it('accepts a well formed payload', () => {
    expect(errorsFor(UpdatePasswordDto, valid)).toEqual([]);
  });

  it('accepts an optional session purge flag', () => {
    expect(
      errorsFor(UpdatePasswordDto, { ...valid, clearSessions: true }),
    ).toEqual([]);
  });

  it('rejects a non-boolean session purge flag', () => {
    expect(
      propertiesFor(UpdatePasswordDto, { ...valid, clearSessions: 'yes' }),
    ).toContain('clearSessions');
  });

  it('requires the current password', () => {
    expect(
      propertiesFor(UpdatePasswordDto, {
        ...valid,
        currentPassword: undefined,
      }),
    ).toContain('currentPassword');
  });
});

describe('LoginDto', () => {
  it('accepts a username and password', () => {
    expect(
      errorsFor(LoginDto, { username: 'testuser', password: 'anything' }),
    ).toEqual([]);
  });

  it('accepts an optional captcha token', () => {
    expect(
      errorsFor(LoginDto, {
        username: 'testuser',
        password: 'x',
        captchaToken: 'token',
      }),
    ).toEqual([]);
  });

  it('places no strength rule on the supplied password', () => {
    expect(
      errorsFor(LoginDto, { username: 'testuser', password: 'weak' }),
    ).toEqual([]);
  });

  it.each(['username', 'password'])('requires a %s', (field) => {
    expect(
      propertiesFor(LoginDto, {
        username: 'testuser',
        password: 'x',
        [field]: 1,
      }),
    ).toContain(field);
  });
});

describe('ConfirmPasswordDto', () => {
  it('accepts a password', () => {
    expect(errorsFor(ConfirmPasswordDto, { password: 'anything' })).toEqual([]);
  });

  it('rejects an empty password', () => {
    expect(propertiesFor(ConfirmPasswordDto, { password: '' })).toContain(
      'password',
    );
  });
});
