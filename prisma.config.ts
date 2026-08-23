import { defineConfig } from 'prisma/config'
import path from 'path'

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    url: `file:${path.join(process.cwd(), 'content.db')}`,
  },
})
