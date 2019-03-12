const properties = PropertiesService.getScriptProperties()
const SLACK_WEBHOOK_URL: string = properties.getProperty('SLACK_WEBHOOK_URL')
const SLACK_CHANNELS: string = properties.getProperty('SLACK_CHANNELS')
const SLACK_BOT_ICON_EMOJI: string =
  properties.getProperty('SLACK_BOT_ICON_EMOJI') || ':sunglasses:'
const SLACK_BOT_USERNAME: string =
  properties.getProperty('SLACK_BOT_USERNAME') || 'gas-notify-calendar-events'
const SLACK_BOT_ATTACHMENT_COLOR: string =
  properties.getProperty('SLACK_BOT_ATTACHMENT_COLOR') || '#7CB342'
// GitHub info
const GITHUB_TOKEN: string = properties.getProperty('GITHUB_TOKEN')
const GITHUB_REPOSITORY_OWNER: string = properties.getProperty(
  'GITHUB_REPOSITORY_OWNER'
)
const GITHUB_REPOSITORY_NAME: string = properties.getProperty(
  'GITHUB_REPOSITORY_NAME'
)
const GITHUB_GRAPHQL_API_ENDPOINT: string = 'https://api.github.com/graphql'

const isWeekend = (): boolean => {
  const day: number = new Date().getDay()
  return day === 0 || day === 6
}

const fetchPullrequests = (): any[] => {
  const query = `{ \
    repository(owner: "${GITHUB_REPOSITORY_OWNER}", name: "${GITHUB_REPOSITORY_NAME}") { \
      pullRequests(first: 100, states: OPEN, orderBy: {field: CREATED_AT, direction: DESC}) { \
        nodes { \
          title \
          url \
          author { \
            login \
          } \
          assignees(first: 100) { \
            nodes { \
              login \
            } \
          } \
          reviewRequests(first: 100) { \
            nodes { \
              requestedReviewer { \
                ... on User { \
                  name \
                  login \
                } \
              } \
            } \
          } \
        } \
      } \
    } \
  }`

  const res: any = fetchFromGitHub(query)
  if (res.data.errors) {
    Logger.log(res.data.errors)
    return []
  }
  if (!res.data.repository) {
    return []
  }
  return res.data.repository.pullRequests.nodes
}

const formatPullrequestMessage = (pullRequest: any): string => {
  // const assignees = pullRequest.assignees.nodes.map( a => `@${a.login}` ).join(', ')
  const reviewers = pullRequest.reviewRequests.nodes
    .map(r => `@${r.requestedReviewer.login}`)
    .join(', ')

  return [
    `*<${pullRequest.url}|${pullRequest.title}>*`,
    // `Author: @${pullRequest.author.login}`,
    // `Assignees: ${assignees}`,
    `review by ${reviewers || '-'}`
  ].join(' ')
}

const fetchFromGitHub = (query: string): any => {
  return JSON.parse(
    UrlFetchApp.fetch(GITHUB_GRAPHQL_API_ENDPOINT, {
      contentType: 'application/json',
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      method: 'post',
      payload: JSON.stringify({ query })
    }).getContentText()
  )
}

const postToSlack = (text: string): void => {
  for (const channel of SLACK_CHANNELS.split(',').map(c => c.trim())) {
    UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
      contentType: 'application/json',
      method: 'post',
      payload: JSON.stringify({
        attachments: [
          {
            color: SLACK_BOT_ATTACHMENT_COLOR,
            text
          }
        ],
        channel,
        icon_emoji: SLACK_BOT_ICON_EMOJI,
        link_names: 1,
        username: SLACK_BOT_USERNAME
      })
    })
  }
}

function main(): void {
  if (isWeekend()) {
    return
  }
  res = fetchPullrequests()
  res = res.filter(pr => pr.reviewRequests.nodes.length > 0)
  if (res.length === 0) {
    return
  }
  const message = res
    .map((pr, i) => `${i + 1}. ${formatPullrequestMessage(pr)}`)
    .join('\n')
  postToSlack(
    ["*Let's get this review requests done:fire:* \n", message].join('\n')
  )
}

function sendTestMessageToSlack(): void {
  postToSlack('This is a test message')
}

function test(): void {
  Logger.log('test')
}
