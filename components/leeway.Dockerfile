# Copyright (c) 2020 Gitpod GmbH. All rights reserved.
# Licensed under the GNU Affero General Public License (AGPL).
# See License.AGPL.txt in the project root for license information.

FROM cgr.dev/chainguard/wolfi-base@sha256:ad3c07c4f23df2a8082beae4636025dba212b4495aa9faa0b5d8acda914a2673
COPY components--all-docker/versions.yaml components--all-docker/provenance-bundle.jsonl /
