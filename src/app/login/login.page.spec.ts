import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import { AuthService } from '../services/auth.service';

import { LoginPage } from './login.page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  let mockAuthService: any;

  beforeEach(async () => {
    mockAuthService = {
      login: vi.fn().mockResolvedValue({ id: 'u1', name: 'Demo User', username: 'demo' }),
      register: vi.fn().mockResolvedValue({ id: 'u2', name: 'New User', username: 'newuser' }),
    };

    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([{ path: 'home', component: class DummyComponent {} }]),
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe alternar entre modo login y register', () => {
    expect(component.mode).toBe('login');
    component.mode = 'register';
    expect(component.mode).toBe('register');
  });

  it('debe invocar login de AuthService al enviar credenciales', async () => {
    component.loginIdentifier = 'demo';
    component.loginPassword = 'demo123';

    await component.handleLogin();

    expect(mockAuthService.login).toHaveBeenCalledWith('demo', 'demo123');
  });
});
