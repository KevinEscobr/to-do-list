import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app.component';
import { AuthService } from './services/auth.service';
import { TaskService } from './services/task.service';

describe('AppComponent', () => {
  it('should create the app', async () => {
    const mockAuth = {
      currentUser: signal(null),
      isAuthenticated: signal(false),
    };

    const mockTasks = {
      totalCount: signal(0),
      syncedCount: signal(0),
      pendingSyncCount: signal(0),
      pendingCount: signal(0),
      isSyncing: signal(false),
      isImporting: signal(false),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: mockAuth },
        { provide: TaskService, useValue: mockTasks },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
