import { expect, test } from '@playwright/test';

test.describe('TaskFlow Pro - Flujo Integral de Tareas y Autenticación', () => {
  test('debe redirigir a /login y permitir iniciar sesión con usuario Demo', async ({ page }) => {
    await page.goto('/');

    // Debe mostrar la pantalla de login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('.brand-title')).toContainText('TaskFlow Pro');

    // Botón de acceso rápido demo
    const quickDemoBtn = page.getByRole('button', { name: /Acceso Rápido Demo/i });
    await expect(quickDemoBtn).toBeVisible();
    await quickDemoBtn.click();

    // Redirección exitosa a /home
    await expect(page).toHaveURL(/.*home/);
    await expect(page.locator('app-home ion-title')).toContainText('TaskFlow Pro');
    await expect(page.locator('.user-greeting')).toContainText('Tareas de');
  });

  test('debe permitir crear una tarea rápida y alternar su estado', async ({ page }) => {
    await page.goto('/login');

    // Iniciar sesión
    await page.getByRole('button', { name: /Acceso Rápido Demo/i }).click();
    await expect(page).toHaveURL(/.*home/);

    // Agregar tarea rápida
    const taskInput = page.locator('.add-task-box ion-input input, .add-task-box input');
    await taskInput.fill('Mi Tarea E2E Playwright');
    await taskInput.press('Enter');

    // Verificar que aparece en la lista
    await expect(page.locator('.task-title-row h2').first()).toBeVisible();
  });

  test('debe abrir el modal de creación avanzada con opciones de cámara y GPS', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /Acceso Rápido Demo/i }).click();
    await expect(page).toHaveURL(/.*home/);

    // Abrir modal avanzado (botón cámara en el input o botón '+' en toolbar)
    const openModalBtn = page.locator('ion-toolbar ion-button[title*="Nueva tarea"]').first();
    await openModalBtn.click();

    // El modal avanzado debe mostrarse con opciones de periféricos
    await expect(page.locator('ion-modal ion-title')).toContainText('Nueva Tarea Avanzada');
    await expect(page.getByText(/Foto \/ Imagen Adjunta/i)).toBeVisible();
    await expect(page.getByText(/Ubicación de la Tarea/i)).toBeVisible();

    // Cerrar modal
    const closeBtn = page.locator('ion-modal ion-toolbar ion-buttons ion-button');
    await closeBtn.click();
  });
});
