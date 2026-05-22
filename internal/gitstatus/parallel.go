package gitstatus

import "sync"

func runParallel(tasks ...func() error) error {
	if len(tasks) == 0 {
		return nil
	}

	var wg sync.WaitGroup
	errCh := make(chan error, len(tasks))
	wg.Add(len(tasks))

	for _, task := range tasks {
		task := task
		go func() {
			defer wg.Done()
			if err := task(); err != nil {
				errCh <- err
			}
		}()
	}

	wg.Wait()
	close(errCh)

	for err := range errCh {
		return err
	}

	return nil
}
