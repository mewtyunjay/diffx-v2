package github

type IntegrationStatus string

const (
	IntegrationOK               IntegrationStatus = "ok"
	IntegrationGHMissing        IntegrationStatus = "gh_missing"
	IntegrationGHUnauthed       IntegrationStatus = "gh_unauthenticated"
	IntegrationRepoUnresolved   IntegrationStatus = "repo_unresolved"
	IntegrationListingFailed    IntegrationStatus = "listing_failed"
	IntegrationPermissionDenied IntegrationStatus = "permission_denied"
	IntegrationMergeBlocked     IntegrationStatus = "merge_blocked"
	IntegrationNotFound         IntegrationStatus = "not_found"
	IntegrationUnknown          IntegrationStatus = "unknown"
)

type IntegrationState struct {
	Status  IntegrationStatus `json:"status"`
	Message string            `json:"message"`
	Action  string            `json:"action,omitempty"`
}

type IntegrationError struct {
	State IntegrationState
	Err   error
}

func (e *IntegrationError) Error() string {
	return e.State.Message
}

func (e *IntegrationError) Unwrap() error {
	return e.Err
}

type RepositoryMergeCapabilities struct {
	MergeCommitAllowed       bool   `json:"mergeCommitAllowed"`
	SquashMergeAllowed       bool   `json:"squashMergeAllowed"`
	RebaseMergeAllowed       bool   `json:"rebaseMergeAllowed"`
	ViewerDefaultMergeMethod string `json:"viewerDefaultMergeMethod,omitempty"`
}

type Repository struct {
	Owner             string                      `json:"owner"`
	Name              string                      `json:"name"`
	URL               string                      `json:"url"`
	MergeCapabilities RepositoryMergeCapabilities `json:"mergeCapabilities"`
}

type PullRequestsResult struct {
	Repo  Repository            `json:"repo"`
	PRs   []PullRequestListItem `json:"prs"`
	State IntegrationState      `json:"state"`
}

type PullRequestListItem struct {
	Number              int      `json:"number"`
	Title               string   `json:"title"`
	URL                 string   `json:"url"`
	Author              string   `json:"author"`
	IsDraft             bool     `json:"isDraft"`
	BaseRefName         string   `json:"baseRefName"`
	HeadRefName         string   `json:"headRefName"`
	HeadRepositoryOwner string   `json:"headRepositoryOwner,omitempty"`
	HeadRepositoryName  string   `json:"headRepositoryName,omitempty"`
	UpdatedAt           string   `json:"updatedAt"`
	CreatedAt           string   `json:"createdAt"`
	Labels              []string `json:"labels"`
	ReviewDecision      string   `json:"reviewDecision,omitempty"`
	CheckConclusion     string   `json:"checkConclusion,omitempty"`
	CommentsCount       int      `json:"commentsCount,omitempty"`
	CommitsCount        int      `json:"commitsCount,omitempty"`
	ChangedFilesCount   int      `json:"changedFilesCount,omitempty"`
}

type PullRequestRef struct {
	RefName         string `json:"refName"`
	SHA             string `json:"sha"`
	RepositoryOwner string `json:"repositoryOwner,omitempty"`
	RepositoryName  string `json:"repositoryName,omitempty"`
}

type PullRequestDetail struct {
	Number            int      `json:"number"`
	Title             string   `json:"title"`
	URL               string   `json:"url"`
	Author            string   `json:"author"`
	Body              string   `json:"body,omitempty"`
	State             string   `json:"state"`
	IsDraft           bool     `json:"isDraft"`
	CreatedAt         string   `json:"createdAt"`
	UpdatedAt         string   `json:"updatedAt"`
	Labels            []string `json:"labels"`
	CommentsCount     int      `json:"commentsCount,omitempty"`
	CommitsCount      int      `json:"commitsCount,omitempty"`
	ChangedFilesCount int      `json:"changedFilesCount,omitempty"`
}

type PullRequestMergeState struct {
	Mergeable      string   `json:"mergeable,omitempty"`
	StateStatus    string   `json:"stateStatus,omitempty"`
	CanMerge       bool     `json:"canMerge"`
	BlockedReason  string   `json:"blockedReason,omitempty"`
	AllowedMethods []string `json:"allowedMethods"`
	DefaultMethod  string   `json:"defaultMethod,omitempty"`
}

type PullRequestChecksSummary struct {
	Conclusion   string `json:"conclusion"`
	TotalCount   int    `json:"totalCount"`
	SuccessCount int    `json:"successCount"`
	FailureCount int    `json:"failureCount"`
	PendingCount int    `json:"pendingCount"`
	SkippedCount int    `json:"skippedCount"`
}

type PullRequestReview struct {
	Author      string `json:"author"`
	State       string `json:"state"`
	SubmittedAt string `json:"submittedAt,omitempty"`
	Body        string `json:"body,omitempty"`
}

type PullRequestReviewsSummary struct {
	Decision          string              `json:"decision,omitempty"`
	RequiredReviewers []string            `json:"requiredReviewers"`
	LatestReviews     []PullRequestReview `json:"latestReviews"`
}

type CommitItem struct {
	Hash       string `json:"hash"`
	ShortHash  string `json:"shortHash"`
	Subject    string `json:"subject"`
	AuthorName string `json:"authorName"`
	AuthorDate string `json:"authorDate"`
}

type PullRequestDetailMetadata struct {
	PR      PullRequestDetail         `json:"pr"`
	Repo    Repository                `json:"repo"`
	Base    PullRequestRef            `json:"base"`
	Head    PullRequestRef            `json:"head"`
	Merge   PullRequestMergeState     `json:"merge"`
	Checks  PullRequestChecksSummary  `json:"checks"`
	Reviews PullRequestReviewsSummary `json:"reviews"`
	Commits []CommitItem              `json:"commits"`
}
