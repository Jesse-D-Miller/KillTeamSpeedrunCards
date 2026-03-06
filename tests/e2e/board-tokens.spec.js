import { test, expect } from '@playwright/test'

const clickBoardAt = async (page, xFactor = 0.5, yFactor = 0.5) => {
  const overlay = page.getByTestId('board-overlay')
  await expect(overlay).toBeVisible()
  const box = await overlay.boundingBox()
  if (!box) throw new Error('Board overlay bounding box unavailable.')
  await page.mouse.click(
    box.x + box.width * xFactor,
    box.y + box.height * yFactor,
  )
}

const createTokenWithRangeAndName = async (page, range = '4', name = 'Alpha') => {
  await page.keyboard.press('=')
  await clickBoardAt(page, 0.45, 0.5)

  const rangeInput = page.locator('[data-testid^="token-range-input-"]').first()
  await expect(rangeInput).toBeVisible()
  await expect(rangeInput).toHaveValue('0')
  await rangeInput.press(range)
  await expect(rangeInput).toHaveValue(range)
  await rangeInput.press('Enter')

  const nameInput = page.locator('[data-testid^="token-name-input-"]').first()
  await expect(nameInput).toBeVisible()
  await nameInput.fill(name)
  await nameInput.press('Enter')

  await expect(nameInput).toHaveCount(0)
}

test('token setup flow: range then name, with slash hide/show label', async ({ page }) => {
  await page.goto('/board')

  await createTokenWithRangeAndName(page, '4', 'Alpha')

  await expect(page.locator('.board-token-range-base')).toHaveCount(1)
  await expect(page.locator('.board-token-text')).toHaveText('ALPHA')

  await page.keyboard.press('/')
  await expect(page.locator('.board-token-text')).toHaveCount(0)

  await page.keyboard.press('/')
  await expect(page.locator('.board-token-text')).toHaveText('ALPHA')
})

test('token drag shows 1-6 movement rings and remove mode deletes token', async ({ page }) => {
  await page.goto('/board')

  await createTokenWithRangeAndName(page, '4', 'Bravo')

  const tokenCenter = page.locator('[data-testid^="token-center-"]').first()
  const centerBox = await tokenCenter.boundingBox()
  if (!centerBox) throw new Error('Token center bounding box unavailable.')
  const centerX = centerBox.x + centerBox.width / 2
  const centerY = centerBox.y + centerBox.height / 2

  await page.mouse.move(centerX, centerY)
  await page.mouse.down()
  await page.mouse.move(centerX + 28, centerY + 16)

  const dragRings = page.locator('.board-token-range-drag')
  await expect(dragRings).toHaveCount(6)

  await expect
    .poll(async () => {
      return dragRings.evaluateAll((nodes) => {
        const strokes = nodes.map((node) => node.getAttribute('stroke') || '')
        const redCount = strokes.filter((stroke) => stroke.includes('220, 40, 40')).length
        const blueCount = strokes.filter((stroke) => stroke.includes('10, 45, 120')).length
        return { redCount, blueCount }
      })
    })
    .toEqual({ redCount: 5, blueCount: 1 })

  await page.mouse.up()
  await expect(page.locator('.board-token-range-drag')).toHaveCount(0)

  await page.keyboard.press('-')
  await clickBoardAt(page, 0.47, 0.52)
  await expect(page.locator('[data-testid^="token-center-"]')).toHaveCount(0)
})
