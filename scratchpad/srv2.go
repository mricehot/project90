package main

import (
	"log"
	"net/http"
)

func main() {
	log.Fatal(http.ListenAndServe("localhost:8791", http.FileServer(http.Dir(".."))))
}
