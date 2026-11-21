package gitstatus

import (
	"maps"
	"testing"
)

func TestParseLineChanges(t *testing.T) {
	t.Parallel()

	got, err := parseLineChanges("3\t1\ta\tb.txt\x00-\t-\timage.png\x002\t0\t\x00before.txt\x00after\nname.txt\x00")
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]LineChanges{
		"a\tb.txt":        {Additions: 3, Deletions: 1},
		"after\nname.txt": {Additions: 2},
	}
	if !maps.Equal(got, want) {
		t.Errorf("line changes = %+v, want %+v", got, want)
	}
}
