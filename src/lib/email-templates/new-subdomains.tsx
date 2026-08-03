import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

export interface NewSubdomainsProps {
  hosts?: { host: string; domain?: string; platform?: string | null }[]
  totalCount?: number
  shownCount?: number
  frequencyLabel?: string
  siteUrl?: string
}

const Email = ({
  hosts = [],
  totalCount = 0,
  shownCount = 0,
  frequencyLabel = 'digest',
  siteUrl = 'https://chaos.thescope.top',
}: NewSubdomainsProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`${totalCount.toLocaleString()} new subdomains discovered`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={label}>CHAOS · {frequencyLabel}</Text>
        <Heading style={heading}>
          {totalCount.toLocaleString()} new subdomains discovered
        </Heading>
        <Text style={sub}>
          These hosts appeared since your last alert. Nothing here has been sent to you before.
        </Text>

        <Section style={box}>
          {hosts.map((h) => (
            <Text key={h.host} style={hostLine}>
              {h.host}
              {h.platform ? <span style={tag}> · {h.platform}</span> : null}
            </Text>
          ))}
        </Section>

        {totalCount > shownCount ? (
          <Text style={sub}>
            + {(totalCount - shownCount).toLocaleString()} more.{' '}
            <Link href={`${siteUrl}/recentsubs`} style={link}>
              View them all
            </Link>
          </Text>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          <Link href={`${siteUrl}/alerts`} style={link}>
            Manage your alerts
          </Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${Number(data?.['totalCount'] ?? 0).toLocaleString()} new subdomains discovered`,
  displayName: 'New subdomains alert',
  previewData: {
    hosts: [
      { host: 'api.staging.lovable.app', domain: 'lovable.app', platform: 'Self' },
      { host: 'vpn.internal.taobao.com', domain: 'taobao.com', platform: 'HackerOne' },
    ],
    totalCount: 128,
    shownCount: 2,
    frequencyLabel: 'Daily digest',
    siteUrl: 'https://chaos.thescope.top',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif' }
const container = { padding: '28px 24px', maxWidth: '640px' }
const label = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '11px',
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: '#71717a',
  margin: '0 0 8px',
}
const heading = { fontSize: '22px', fontWeight: 800, color: '#09090b', margin: '0 0 6px' }
const sub = { fontSize: '14px', color: '#52525b', margin: '0 0 16px', lineHeight: '22px' }
const box = {
  border: '1px solid #e4e4e7',
  borderRadius: '10px',
  padding: '12px 14px',
  backgroundColor: '#fafafa',
}
const hostLine = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '13px',
  color: '#18181b',
  margin: '0 0 4px',
  wordBreak: 'break-all' as const,
}
const tag = { color: '#a1a1aa' }
const hr = { borderColor: '#e4e4e7', margin: '22px 0 12px' }
const footer = { fontSize: '12px', color: '#71717a', margin: 0 }
const link = { color: '#2563eb', textDecoration: 'underline' }

export default Email
